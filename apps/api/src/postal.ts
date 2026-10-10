import { Injectable, BadRequestException, NotFoundException, ServiceUnavailableException, GatewayTimeoutException } from '@nestjs/common';
@Injectable()
export class Postal {
 async lookup(zip:string) {
  if(!/^\d{8}$/.test(zip)) throw new BadRequestException('Informe um CEP de 8 dígitos');
  let res:Response;
  try { res=await fetch('https://viacep.com.br/ws/'+zip+'/json/',{signal:AbortSignal.timeout(3000)}); }
  catch(e) { if(typeof e === 'object' && e !== null && 'name' in e && (e.name==='TimeoutError'||e.name==='AbortError')) throw new GatewayTimeoutException('Consulta de CEP excedeu o tempo limite'); throw new ServiceUnavailableException('Consulta de CEP indisponível'); }
  if(!res.ok) throw new ServiceUnavailableException('Consulta de CEP indisponível');
  let data:any;
  try { data=await res.json(); } catch { throw new ServiceUnavailableException('Resposta inválida do serviço de CEP'); }
  if(data.erro) throw new NotFoundException('CEP não encontrado');
  if(typeof data.logradouro!=='string'||typeof data.localidade!=='string'||typeof data.uf!=='string') throw new ServiceUnavailableException('Resposta inválida do serviço de CEP');
  return {zip,address:[data.logradouro,data.bairro,data.localidade,data.uf].filter(Boolean).join(', ')};
 }
}