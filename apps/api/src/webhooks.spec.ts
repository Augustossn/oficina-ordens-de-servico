import { signature,verifySignature } from './webhooks';
describe('Assinatura de webhook',()=>{
 beforeAll(()=>{process.env.WEBHOOK_SECRET='test-webhook-secret-with-32-characters';});
 const raw=Buffer.from('{"orderId":"test","status":"DONE","version":2}');
 it('aceita assinatura válida sobre o corpo original',()=>{const ts=String(Math.floor(Date.now()/1000));expect(()=>verifySignature('evt-1',ts,signature('evt-1',ts,raw),raw)).not.toThrow();});
 it('rejeita corpo modificado',()=>{const ts=String(Math.floor(Date.now()/1000));expect(()=>verifySignature('evt-1',ts,signature('evt-1',ts,raw),Buffer.from('{}'))).toThrow();});
 it('rejeita evento expirado',()=>{const ts=String(Math.floor(Date.now()/1000)-600);expect(()=>verifySignature('evt-1',ts,signature('evt-1',ts,raw),raw)).toThrow();});
 it('rejeita assinatura ausente',()=>expect(()=>verifySignature('evt-1','123','','' as any)).toThrow());
});