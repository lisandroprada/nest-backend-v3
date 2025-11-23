import { Module, forwardRef } from '@nestjs/common';
import { AccountingEntriesService } from './accounting-entries.service';
import { AccountingEntriesController } from './accounting-entries.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AccountingEntry,
  AccountingEntrySchema,
} from './entities/accounting-entry.entity';
import { CommonModule } from 'src/common/common.module';
import { AuthModule } from '../auth/auth.module';
import { FinancialAccountsModule } from '../financial-accounts/financial-accounts.module';
import { DetectedExpensesModule } from '../detected-expenses/detected-expenses.module';
import { PropertiesModule } from '../properties/properties.module';
import { ChartOfAccountsModule } from '../chart-of-accounts/chart-of-accounts.module';
import { ServiceAccountMappingsModule } from '../service-account-mappings/service-account-mappings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AccountingEntry.name, schema: AccountingEntrySchema },
    ]),
    CommonModule,
    AuthModule,
    FinancialAccountsModule,
    DetectedExpensesModule,
    forwardRef(() => PropertiesModule),
    ChartOfAccountsModule,
    ServiceAccountMappingsModule,
  ],
  controllers: [AccountingEntriesController],
  providers: [AccountingEntriesService],
  exports: [AccountingEntriesService],
})
export class AccountingEntriesModule {}
