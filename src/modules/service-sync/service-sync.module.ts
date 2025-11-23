import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import {
  ServiceCommunication,
  ServiceCommunicationSchema,
} from './entities/service-communication.entity';
import { SystemConfigModule } from '../system-config/system-config.module';
import { DetectedExpensesModule } from '../detected-expenses/detected-expenses.module';
import { AgentsModule } from '../agents/agents.module';
import { PropertiesModule } from '../properties/properties.module';
import { CamuzziScanService } from './services/camuzzi-scan.service';
import {
  Property,
  PropertySchema,
} from '../properties/entities/property.entity';
import { Agent, AgentSchema } from '../agents/entities/agent.entity';
import { ServiceSyncController } from './service-sync.controller';
import { ClassificationService } from './services/classification.service';
import { ServiceSyncService } from './service-sync.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: ServiceCommunication.name, schema: ServiceCommunicationSchema },
      // Local registrations for read/query needs
      { name: Property.name, schema: PropertySchema },
      { name: Agent.name, schema: AgentSchema },
    ]),
    SystemConfigModule,
    DetectedExpensesModule,
    AgentsModule,
    PropertiesModule,
  ],
  controllers: [ServiceSyncController],
  providers: [ServiceSyncService, CamuzziScanService, ClassificationService],
  exports: [ServiceSyncService],
})
export class ServiceSyncModule {}
