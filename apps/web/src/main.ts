import { Component, OnInit } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
type Status='OPEN'|'IN_PROGRESS'|'DONE'|'CANCELED';
type Customer={id:string;name:string;email?:string;phone:string;zip:string;address:string};
type Order={id:string;title:string;description:string;status:Status;version:number;customerId:string;technicianId:string|null;customer:Customer;technician?:{id:string;name:string};createdAt:string};
@Component({selector:'app-root',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./app.html'})
class App implements OnInit {
 user:any=null;email='gestor@demo.local';password='';token=sessionStorage.getItem('token')||'';
 view='orders';busy=false;loading=false;postalBusy=false;error='';modalError='';notice='';query='';filter='';page=1;pages=1;total=0;
 orders:Order[]=[];customers:Customer[]=[];technicians:{id:string;name:string}[]=[];selected:Order|null=null;
 modal='';editId='';editVersion=1;customerId='';
 draft={title:'',description:'',customerId:'',technicianId:''};
 customerDraft={name:'',email:'',phone:'',zip:'',address:''};
 labels:Record<Status,string>={OPEN:'Em aberto',IN_PROGRESS:'Em andamento',DONE:'Concluída',CANCELED:'Cancelada'};
 get isManager(){return this.user?.role==='MANAGER';}
 async ngOnInit(){if(this.token){try{const actor=await this.api('/me');this.user={...actor,name:sessionStorage.getItem('name')||'Usuário'};await this.initialize();}catch{this.logout();}}}
 async api(path:string,method='GET',data?:unknown){
  const res=await fetch('/api'+path,{method,signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',...(this.token?{Authorization:'Bearer '+this.token}:{})},...(data?{body:JSON.stringify(data)}:{})});
  const body=await res.json().catch(()=>({message:'Resposta inválida do servidor'}));
  if(!res.ok){if(res.status===401&&this.user)this.logout();throw new Error(Array.isArray(body.message)?body.message.join('; '):body.message||'Não foi possível concluir');}
  return body;
 }
 message(e:unknown){return e instanceof TypeError?'Não foi possível conectar ao servidor. Tente novamente.':e instanceof Error?e.message:'Ocorreu um erro';}
 async login(){this.busy=true;this.error='';try{const data=await this.api('/auth/login','POST',{email:this.email,password:this.password});this.token=data.token;this.user=data.user;sessionStorage.setItem('token',this.token);sessionStorage.setItem('name',this.user.name);this.password='';await this.initialize();}catch(e){this.error=this.message(e);}finally{this.busy=false;}}
 logout(){sessionStorage.clear();this.token='';this.user=null;this.modal='';this.orders=[];this.customers=[];this.technicians=[];this.error='';}
 async initialize(){try{if(this.isManager){[this.customers,this.technicians]=await Promise.all([this.api('/customers'),this.api('/users/technicians')]);}await this.load();}catch(e){this.error=this.message(e);}}
 async load(){this.loading=true;this.error='';try{if(this.view==='orders'){const params=new URLSearchParams({page:String(this.page)});if(this.filter)params.set('status',this.filter);if(this.query)params.set('q',this.query);const data=await this.api('/orders?'+params);this.orders=data.items;this.total=data.total;this.pages=data.pages;}else this.customers=await this.api('/customers');}catch(e){this.error=this.message(e);}finally{this.loading=false;}}
 setView(view:string){this.view=view;this.notice='';void this.load();}
 setFilter(status:string){this.filter=status;this.page=1;void this.load();}
 search(){this.page=1;void this.load();}
 count(status:Status){return this.orders.filter(o=>o.status===status).length;}
 openOrder(order?:Order){this.modalError='';this.editId=order?.id||'';this.editVersion=order?.version||1;this.draft={title:order?.title||'',description:order?.description||'',customerId:order?.customerId||'',technicianId:order?.technicianId||''};this.modal='order';}
 openCustomer(customer?:Customer){this.modalError='';this.customerId=customer?.id||'';this.customerDraft={name:customer?.name||'',email:customer?.email||'',phone:customer?.phone||'',zip:customer?.zip||'',address:customer?.address||''};this.modal='customer';}
 closeModal(){if(!this.busy&&!this.postalBusy)this.modal='';}
 async saveOrder(){this.busy=true;this.modalError='';try{await this.api('/orders'+(this.editId?'/'+this.editId:''),this.editId?'PUT':'POST',{...this.draft,...(this.editId?{version:this.editVersion}:{})});this.modal='';this.notice='Ordem salva com sucesso.';await this.load();}catch(e){this.modalError=this.message(e);}finally{this.busy=false;}}
 async saveCustomer(){this.busy=true;this.modalError='';try{const data:any={...this.customerDraft};if(!data.email)delete data.email;await this.api('/customers'+(this.customerId?'/'+this.customerId:''),this.customerId?'PUT':'POST',data);this.customers=await this.api('/customers');this.modal='';this.notice='Cliente salvo com sucesso.';}catch(e){this.modalError=this.message(e);}finally{this.busy=false;}}
 async lookup(){this.postalBusy=true;this.modalError='';try{const result=await this.api('/postal/'+encodeURIComponent(this.customerDraft.zip));this.customerDraft.address=result.address;}catch(e){this.modalError=this.message(e);}finally{this.postalBusy=false;}}
 openDetail(order:Order){this.selected=order;this.modalError='';this.modal='detail';}
 async refreshDetail(){if(!this.selected)return;this.busy=true;try{this.selected=await this.api('/orders/'+this.selected.id);this.modalError='';}catch(e){this.modalError=this.message(e);}finally{this.busy=false;}}
 async changeStatus(status:Status){if(!this.selected)return;if(status==='CANCELED'&&!confirm('Cancelar esta ordem? Esta ação encerra o atendimento.'))return;this.busy=true;this.modalError='';try{await this.api('/orders/'+this.selected.id+'/status','PATCH',{status,version:this.selected.version});this.selected=await this.api('/orders/'+this.selected.id);await this.load();}catch(e){this.modalError=this.message(e);}finally{this.busy=false;}}
}
bootstrapApplication(App).catch(console.error);
