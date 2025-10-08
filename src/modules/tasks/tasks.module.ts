import { Module } from '@nestjs/common';
import { AdjustmentService } from './adjustment/adjustment.service';
import { ContractsModule } from '../contracts/contracts.module';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Contract,
  ContractSchema,
} from '../contracts/entities/contract.entity';
import { EmailScanService } from './email-scan/email-scan.service';
import { AgentsModule } from '../agents/agents.module';
import { DetectedExpensesModule } from '../detected-expenses/detected-expenses.module';

@Module({
  imports: [
    ContractsModule, // Importa el módulo de contratos
    MongooseModule.forFeature([
      { name: Contract.name, schema: ContractSchema },
    ]),
    AgentsModule,
    DetectedExpensesModule,
  ],
  providers: [AdjustmentService, EmailScanService],
})
export class TasksModule {}
