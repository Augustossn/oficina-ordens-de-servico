import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './module';
async function main() {
 if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET precisa ter ao menos 32 caracteres');
 if (!process.env.WEBHOOK_SECRET || process.env.WEBHOOK_SECRET.length < 32) throw new Error('WEBHOOK_SECRET precisa ter ao menos 32 caracteres');
 const app = await NestFactory.create(AppModule, { rawBody: true });
 app.enableCors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:4200').split(',') });
 app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
 app.enableShutdownHooks();
 await app.listen(3000, '0.0.0.0');
}
main();