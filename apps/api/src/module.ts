import { Global, Module } from '@nestjs/common';
import { Database } from './database';
import { AuthGuard } from './auth';
import { Orders } from './orders';
import { Postal } from './postal';
import { Webhooks } from './webhooks';
import { PublicController,ApiController } from './controllers';
@Global()
@Module({providers:[Database,AuthGuard],exports:[Database,AuthGuard]})
class InfrastructureModule {}
@Module({providers:[Orders],exports:[Orders]})
class OrdersModule {}
@Module({providers:[Postal,Webhooks],exports:[Postal,Webhooks]})
class IntegrationsModule {}
@Module({imports:[InfrastructureModule,OrdersModule,IntegrationsModule],controllers:[PublicController,ApiController]})
export class AppModule {}
