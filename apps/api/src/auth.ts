import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { verify } from 'jsonwebtoken';
import { Database } from './database';
export type Actor = { id: string; role: 'MANAGER' | 'TECHNICIAN' };
@Injectable()
export class AuthGuard implements CanActivate {
 constructor(private db: Database) {}
 async canActivate(context: ExecutionContext) {
  const req = context.switchToHttp().getRequest();
  try {
   const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
   const payload = verify(token || '', process.env.JWT_SECRET!, { algorithms: ['HS256'] });
   if (typeof payload === 'string' || !payload.sub) throw new Error();
   const user = await this.db.user.findUnique({ where: { id: payload.sub } });
   if (!user) throw new Error();
   req.actor = { id: user.id, role: user.role };
   return true;
  } catch { throw new UnauthorizedException('Sessão inválida ou expirada'); }
 }
}
export function manager(actor: Actor) {
 if (actor.role !== 'MANAGER') throw new ForbiddenException('Acesso exclusivo do gestor');
}
export function scope(actor: Actor) {
 return actor.role === 'MANAGER' ? {} : { technicianId: actor.id };
}