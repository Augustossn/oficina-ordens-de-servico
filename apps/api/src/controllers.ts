import { Controller, Get, Post, Put, Patch, Body, Param, Query, Req, UseGuards, UnauthorizedException, HttpCode, RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { compare, hash } from 'bcryptjs';
import { sign } from 'jsonwebtoken';
import { Database } from './database';
import { AuthGuard, Actor, manager } from './auth';
import { LoginDto, CustomerDto, OrderDto, UpdateOrderDto, StatusDto, ListDto, WebhookDto, UserDto } from './dto';
import { Orders } from './orders';
import { Postal } from './postal';
import { Webhooks, verifySignature } from './webhooks';
type Authed = Request & {actor:Actor};
@Controller()
export class PublicController {
 constructor(private db:Database,private hooks:Webhooks) {}
 @Get('health') health(){return {ok:true};}
 @Post('auth/login') @HttpCode(200)
 async login(@Body() body:LoginDto) {
  const user=await this.db.user.findUnique({where:{email:body.email.toLowerCase()}});
  if(!user || !await compare(body.password,user.passwordHash)) throw new UnauthorizedException('E-mail ou senha incorretos');
  return {token:sign({},process.env.JWT_SECRET!,{subject:user.id,expiresIn:'8h',algorithm:'HS256'}),user:{id:user.id,name:user.name,role:user.role}};
 }
 @Post('webhooks/status') @HttpCode(200)
 async webhook(@Req() req:RawBodyRequest<Request>,@Body() body:WebhookDto) {
  const id=String(req.headers['x-event-id']||'');
  verifySignature(id,String(req.headers['x-timestamp']||''),String(req.headers['x-signature']||''),req.rawBody||Buffer.alloc(0));
  return this.hooks.receive(id,body);
 }
}
@Controller() @UseGuards(AuthGuard)
export class ApiController {
 constructor(private db:Database,private orders:Orders,private postal:Postal) {}
 @Get('users') async users(@Req() req:Authed){manager(req.actor);return this.db.user.findMany({select:{id:true,name:true,email:true,role:true},orderBy:{name:'asc'}});}
 @Post('users') async createUser(@Req() req:Authed,@Body() body:UserDto){manager(req.actor);return this.db.user.create({data:{name:body.name,email:body.email.toLowerCase(),role:body.role,passwordHash:await hash(body.password,12)},select:{id:true,name:true,email:true,role:true}});}
 @Get('me') me(@Req() req:Authed){return req.actor;}
 @Get('users/technicians') async technicians(@Req() req:Authed){manager(req.actor);return this.db.user.findMany({where:{role:'TECHNICIAN'},select:{id:true,name:true}});}
 @Get('customers') async customers(@Req() req:Authed){manager(req.actor);return this.db.customer.findMany({orderBy:{name:'asc'}});}
 @Post('customers') async createCustomer(@Req() req:Authed,@Body() body:CustomerDto){manager(req.actor);return this.db.customer.create({data:body});}
 @Put('customers/:id') async editCustomer(@Req() req:Authed,@Param('id') id:string,@Body() body:CustomerDto){manager(req.actor);return this.db.customer.update({where:{id},data:body});}
 @Get('orders') list(@Req() req:Authed,@Query() query:ListDto){return this.orders.list(req.actor,query);}
 @Get('orders/:id') get(@Req() req:Authed,@Param('id') id:string){return this.orders.get(req.actor,id);}
 @Post('orders') create(@Req() req:Authed,@Body() body:OrderDto){return this.orders.create(req.actor,body);}
 @Put('orders/:id') edit(@Req() req:Authed,@Param('id') id:string,@Body() body:UpdateOrderDto){return this.orders.edit(req.actor,id,body);}
 @Patch('orders/:id/status') status(@Req() req:Authed,@Param('id') id:string,@Body() body:StatusDto){return this.orders.change(req.actor,id,body.status,body.version);}
 @Get('postal/:zip') lookup(@Param('zip') zip:string){return this.postal.lookup(zip);}
}