import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FinancialReportsController } from './financial-reports.controller';
import { FinancialReportsService } from './financial-reports.service';
import {
  AccountingEntry,
  AccountingEntrySchema,
} from '../accounting-entries/entities/accounting-entry.entity';
import {
  ChartOfAccount,
  ChartOfAccountSchema,
} from '../chart-of-accounts/entities/chart-of-account.entity';
import {
  FinancialAccount,
  FinancialAccountSchema,
} from '../financial-accounts/entities/financial-account.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AccountingEntry.name, schema: AccountingEntrySchema },
      { name: ChartOfAccount.name, schema: ChartOfAccountSchema },
      { name: FinancialAccount.name, schema: FinancialAccountSchema },
    ]),
  ],
  controllers: [FinancialReportsController],
  providers: [FinancialReportsService],
  exports: [FinancialReportsService],
})
export class FinancialReportsModule {}
