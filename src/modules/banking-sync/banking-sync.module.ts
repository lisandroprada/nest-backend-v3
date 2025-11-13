import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BankingSyncController } from './banking-sync.controller';
import { BankingSyncService } from './banking-sync.service';
import { RedlinkScanService } from './redlink-scan.service';
import {
  BankMovement,
  BankMovementSchema,
} from './entities/bank-movement.entity';
import {
  ConciliationCandidate,
  ConciliationCandidateSchema,
} from './entities/conciliation-candidate.entity';
import { ConciliationService } from './conciliation.service';
import { SystemConfigModule } from '../system-config/system-config.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BankMovement.name, schema: BankMovementSchema },
      { name: ConciliationCandidate.name, schema: ConciliationCandidateSchema },
    ]),
    SystemConfigModule,
    TransactionsModule,
  ],
  controllers: [BankingSyncController],
  providers: [BankingSyncService, RedlinkScanService, ConciliationService],
  exports: [BankingSyncService],
})
export class BankingSyncModule {}
