import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
const db=new PrismaClient();
async function main(){
 const passwordHash=await hash('Demo12345!',12);
 await db.user.upsert({where:{email:'gestor@demo.local'},update:{},create:{id:'manager-demo',name:'Marina Oliveira',email:'gestor@demo.local',passwordHash,role:'MANAGER'}});
 for(const [id,name,email] of [['tech-ana','Ana Santos','ana@demo.local'],['tech-lucas','Lucas Costa','lucas@demo.local']]){
  await db.user.upsert({where:{email},update:{},create:{id,name,email,passwordHash,role:'TECHNICIAN'}});
 }
 const customer=await db.customer.upsert({where:{id:'customer-demo'},update:{},create:{id:'customer-demo',name:'Café Aurora',phone:'11999999999',zip:'01001000',address:'Praça da Sé, São Paulo, SP'}});
 for(const [i,title] of ['Manutenção do ar-condicionado','Revisão do quadro elétrico','Troca de filtro de água'].entries()){
  await db.serviceOrder.upsert({where:{id:'order-demo-'+i},update:{},create:{id:'order-demo-'+i,title,description:'Verificar equipamento, registrar diagnóstico e realizar manutenção preventiva.',customerId:customer.id,technicianId:i===1?'tech-lucas':'tech-ana',status:i===0?'IN_PROGRESS':'OPEN'}});
 }
}
main().finally(()=>db.$disconnect());