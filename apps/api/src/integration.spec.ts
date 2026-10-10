import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { INestApplication,ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { hash } from 'bcryptjs';
import { AppModule } from './module';
import { Database } from './database';
import { signature } from './webhooks';
const integration=process.env.TEST_DATABASE_URL?describe:describe.skip;
integration('API + MySQL',()=>{
 let app:INestApplication,db:Database,manager:string,ana:string,lucas:string,id:string;
 beforeAll(async()=>{
  process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
  process.env.JWT_SECRET='integration-jwt-secret-32-characters';
  process.env.WEBHOOK_SECRET='integration-webhook-secret-32-characters';
  delete process.env.WEBHOOK_URL;
  app=await NestFactory.create(AppModule,{rawBody:true,logger:false});
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  await app.init();db=app.get(Database);
  const passwordHash=await hash('Demo12345!',4);
  await db.user.createMany({data:[{id:'it-manager',name:'Gestor',email:'it-manager@test.local',role:'MANAGER',passwordHash},{id:'it-ana',name:'Ana',email:'it-ana@test.local',role:'TECHNICIAN',passwordHash},{id:'it-lucas',name:'Lucas',email:'it-lucas@test.local',role:'TECHNICIAN',passwordHash}]});
  await db.customer.create({data:{id:'it-customer',name:'Teste',phone:'1199999999',zip:'01001000',address:'Praça da Sé'}});
  async function login(email:string){const res=await request(app.getHttpServer()).post('/auth/login').send({email,password:'Demo12345!'}).expect(200);return res.body.token;}
  manager=await login('it-manager@test.local');ana=await login('it-ana@test.local');lucas=await login('it-lucas@test.local');
 },30000);
 afterAll(async()=>{
  if(db){await db.webhookReceipt.deleteMany({where:{id:{startsWith:'it-'}}});await db.outbox.deleteMany({where:{payload:{contains:'it-order'}}});await db.serviceOrder.deleteMany({where:{customerId:'it-customer'}});await db.customer.deleteMany({where:{id:'it-customer'}});await db.user.deleteMany({where:{id:{startsWith:'it-'}}});}
  if(app)await app.close();
 });
 beforeEach(async()=>{id='it-order-'+Date.now()+'-'+Math.random();await db.serviceOrder.create({data:{id,title:'Teste integração',description:'Verificar equipamento',customerId:'it-customer',technicianId:'it-ana'}});});
 it('exige autenticação',async()=>{await request(app.getHttpServer()).get('/orders').expect(401);});
 it('técnico não acessa nem altera ordem alheia',async()=>{
  await request(app.getHttpServer()).get('/orders/'+id).auth(lucas,{type:'bearer'}).expect(404);
  await request(app.getHttpServer()).patch('/orders/'+id+'/status').auth(lucas,{type:'bearer'}).send({status:'IN_PROGRESS',version:1}).expect(404);
  const list=await request(app.getHttpServer()).get('/orders').auth(lucas,{type:'bearer'}).expect(200);expect(list.body.items).toHaveLength(0);
 });
 it('técnico não cria ordem nem lista clientes',async()=>{
  await request(app.getHttpServer()).post('/orders').auth(ana,{type:'bearer'}).send({title:'Teste',description:'Descrição',customerId:'it-customer'}).expect(403);
  await request(app.getHttpServer()).get('/customers').auth(ana,{type:'bearer'}).expect(403);
 });
 it('gestor cria e atribui ordem',async()=>{
  const res=await request(app.getHttpServer()).post('/orders').auth(manager,{type:'bearer'}).send({title:'Nova ordem',description:'Manutenção preventiva',customerId:'it-customer',technicianId:'it-ana'}).expect(201);expect(res.body.technicianId).toBe('it-ana');
 });
 it('duas atualizações simultâneas produzem um sucesso e um conflito',async()=>{
  const update=()=>request(app.getHttpServer()).patch('/orders/'+id+'/status').auth(ana,{type:'bearer'}).send({status:'IN_PROGRESS',version:1});
  const results=await Promise.all([update(),update()]);expect(results.map(x=>x.status).sort()).toEqual([200,409]);
  expect((await db.serviceOrder.findUniqueOrThrow({where:{id}})).version).toBe(2);
  expect(await db.outbox.count({where:{payload:{contains:id}}})).toBe(1);
 });
 it('edição desatualizada não sobrescreve dados',async()=>{
  const data={title:'Atualizada',description:'Descrição nova',customerId:'it-customer',technicianId:'it-ana',version:1};
  await request(app.getHttpServer()).put('/orders/'+id).auth(manager,{type:'bearer'}).send(data).expect(200);
  await request(app.getHttpServer()).put('/orders/'+id).auth(manager,{type:'bearer'}).send({...data,title:'Antiga'}).expect(409);
 });
 it('rejeita dados inválidos',async()=>{
  await request(app.getHttpServer()).patch('/orders/'+id+'/status').auth(ana,{type:'bearer'}).send({status:'INVALID',version:0}).expect(400);
 });
 it('webhook duplicado é processado uma vez',async()=>{
  const eventId='it-event-'+Date.now(),ts=String(Math.floor(Date.now()/1000));
  const body=JSON.stringify({orderId:id,status:'OPEN',version:1});
  const send=()=>request(app.getHttpServer()).post('/webhooks/status').set('Content-Type','application/json').set('x-event-id',eventId).set('x-timestamp',ts).set('x-signature',signature(eventId,ts,body)).send(body);
  const responses=await Promise.all([send(),send()]);expect(responses.map(x=>x.status)).toEqual([200,200]);expect(responses.map(x=>x.body.duplicate).sort()).toEqual([false,true]);expect(await db.webhookReceipt.count({where:{id:eventId}})).toBe(1);
 });
 it('webhook sem assinatura é rejeitado',async()=>{await request(app.getHttpServer()).post('/webhooks/status').send({orderId:id,status:'OPEN',version:1}).expect(401);});
});