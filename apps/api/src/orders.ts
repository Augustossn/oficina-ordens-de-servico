import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { Database } from './database';
import { Actor, manager, scope } from './auth';
import { OrderDto, UpdateOrderDto, ListDto } from './dto';
@Injectable()
export class Orders {
 constructor(private db: Database) {}
 async list(actor: Actor, query: ListDto) {
  const page = Number(query.page || 1), take = 10;
  const where: Prisma.ServiceOrderWhereInput = { ...scope(actor), ...(query.status ? { status: query.status } : {}), ...(query.q ? { OR: [{ title: { contains: query.q } }, { customer: { name: { contains: query.q } } }] } : {}) };
  const [items, total] = await this.db.$transaction([
   this.db.serviceOrder.findMany({ where, include: { customer: true, technician: { select: { id:true, name:true } } }, orderBy: [{ createdAt:'desc' },{ id:'desc' }], skip:(page-1)*take, take }),
   this.db.serviceOrder.count({ where })
  ]);
  return { items, total, page, pages: Math.ceil(total / take) };
 }
 async get(actor: Actor, id: string) {
  const order = await this.db.serviceOrder.findFirst({ where: { id, ...scope(actor) }, include: { customer: true, technician: { select: { id:true,name:true } } } });
  if (!order) throw new NotFoundException('Ordem não encontrada');
  return order;
 }
 async validate(data: OrderDto) {
  if (!await this.db.customer.findUnique({ where: { id:data.customerId } })) throw new BadRequestException('Cliente inexistente');
  if (data.technicianId && !await this.db.user.findFirst({ where: { id:data.technicianId, role:'TECHNICIAN' } })) throw new BadRequestException('Técnico inválido');
 }
 async create(actor: Actor, data: OrderDto) {
  manager(actor); await this.validate(data);
  return this.db.serviceOrder.create({ data: { ...data, technicianId: data.technicianId || null } });
 }
 async edit(actor: Actor,id:string,data:UpdateOrderDto) {
  manager(actor); await this.get(actor,id); await this.validate(data);
  const { version,...fields }=data;
  const result=await this.db.serviceOrder.updateMany({ where:{id,version},data:{...fields,technicianId:fields.technicianId || null,version:{increment:1}} });
  if (!result.count) throw new ConflictException('Esta ordem foi alterada. Recarregue antes de salvar.');
  return this.get(actor,id);
 }
 async change(actor:Actor,id:string,status:Status,version:number) {
  return this.db.$transaction(async tx => {
   const order=await tx.serviceOrder.findFirst({where:{id,...scope(actor)}});
   if(!order) throw new NotFoundException('Ordem não encontrada');
   if(order.version!==version) throw new ConflictException('Esta ordem foi alterada. Recarregue antes de salvar.');
   if(order.status===status) return order;
   const allowed:Record<Status,Status[]>={OPEN:['IN_PROGRESS','CANCELED'],IN_PROGRESS:['DONE','CANCELED'],DONE:[],CANCELED:[]};
   if(!allowed[order.status].includes(status)) throw new BadRequestException('Transição de status inválida');
   const result=await tx.serviceOrder.updateMany({where:{id,version,...scope(actor)},data:{status,version:{increment:1}}});
   if(!result.count) throw new ConflictException('Atualização simultânea detectada');
   const updated=await tx.serviceOrder.findUniqueOrThrow({where:{id}});
   await tx.outbox.create({data:{payload:JSON.stringify({orderId:id,status,version:updated.version})}});
   return updated;
  });
 }
}