import { Postal } from './postal';
describe('CEP',()=>{
 const postal=new Postal();
 afterEach(()=>jest.restoreAllMocks());
 it('rejeita CEP inválido antes de consultar',async()=>{const fetcher=jest.spyOn(global,'fetch');await expect(postal.lookup('123')).rejects.toMatchObject({status:400});expect(fetcher).not.toHaveBeenCalled();});
 it('trata timeout',async()=>{jest.spyOn(global,'fetch').mockRejectedValue(new DOMException('timeout','TimeoutError'));await expect(postal.lookup('01001000')).rejects.toMatchObject({status:504});});
 it('trata indisponibilidade',async()=>{jest.spyOn(global,'fetch').mockRejectedValue(new Error('offline'));await expect(postal.lookup('01001000')).rejects.toMatchObject({status:503});});
 it('trata CEP inexistente',async()=>{jest.spyOn(global,'fetch').mockResolvedValue(new Response(JSON.stringify({erro:true})));await expect(postal.lookup('00000000')).rejects.toMatchObject({status:404});});
 it('trata resposta inválida',async()=>{jest.spyOn(global,'fetch').mockResolvedValue(new Response('{}'));await expect(postal.lookup('01001000')).rejects.toMatchObject({status:503});});
 it('retorna endereço',async()=>{jest.spyOn(global,'fetch').mockResolvedValue(new Response(JSON.stringify({logradouro:'Praça da Sé',bairro:'Sé',localidade:'São Paulo',uf:'SP'})));await expect(postal.lookup('01001000')).resolves.toEqual({zip:'01001000',address:'Praça da Sé, Sé, São Paulo, SP'});});
});