import { Injectable, OnModuleInit, OnModuleDestroy, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Database } from './database';
import { Prisma } from '@prisma/client';
import { WebhookDto } from './dto';
export function signature(id:string,timestamp:string,raw:Buffer|string) {
 return createHmac('sha256',process.env.WEBHOOK_SECRET!).update(id+'.'+timestamp+'.').update(raw).digest('hex');
}
export function verifySignature(id:string,ts:string,sig:string,raw:Buffer) {
 if(!/^[a-zA-Z0-9-]{1,100}$/.test(id) || !/^\d{10}$/.test(ts) || Math.abs(Date.now()/1000-Number(ts))>300 || !/^[a-f0-9]{64}$/.test(sig)) throw new UnauthorizedException('Webhook inválido');
 if(!timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(signature(id,ts,raw),'hex'))) throw new UnauthorizedException('Assinatura inválida');
}
@Injectable()
export class Webhooks implements OnModuleInit,OnModuleDestroy {
 private timer?:NodeJS.Timeout;
 private busy=false;
 constructor(private db:Database) {}
 onModuleInit() { this.timer=setInterval(()=>void this.deliver(),5000); }
 onModuleDestroy(){clearInterval(this.timer);}
 async receive(id:string,data:WebhookDto) {
  // Inbox durável: efeitos e recibo precisam sempre compartilhar esta transação.
  try {
   await this.db.$transaction(async tx=>{
    await tx.webhookReceipt.create({data:{id}});
    const current=await tx.serviceOrder.findUnique({where:{id:data.orderId}});
    if(!current) throw new BadRequestException('Ordem inexistente');
    // Confirmação do evento emitido; não reemite nem altera o status.
    if(current.version<data.version) throw new ConflictException('Evento está à frente do estado local');
   });
   return {accepted:true,duplicate:false};
  } catch(e) {
   if(e instanceof Prisma.PrismaClientKnownRequestError && e.code==='P2002') return {accepted:true,duplicate:true};
   throw e;
  }
 }
 async deliver() {
  const url=process.env.WEBHOOK_URL;
  if(!url || this.busy) return;
  this.busy=true;
  try {
   const events=await this.db.outbox.findMany({where:{deliveredAt:null,nextAttemptAt:{lte:new Date()}},take:20,orderBy:{createdAt:'asc'}});
   for(const event of events) {
    try {
     const ts=String(Math.floor(Date.now()/1000));
     const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-event-id':event.id,'x-timestamp':ts,'x-signature':signature(event.id,ts,event.payload)},body:event.payload,signal:AbortSignal.timeout(5000)});
     if(!res.ok) throw new Error('HTTP '+res.status);
     await this.db.outbox.update({where:{id:event.id},data:{deliveredAt:new Date(),attempts:{increment:1}}});
    } catch {
     await this.db.outbox.update({where:{id:event.id},data:{attempts:{increment:1},nextAttemptAt:new Date(Date.now()+Math.min(3600000,5000*2**Math.min(event.attempts,10)))}});
    }
   }
  } catch(e) { console.error('Falha no processamento da outbox',e instanceof Error ? e.message : 'erro'); }
  finally { this.busy=false; }
 }
}