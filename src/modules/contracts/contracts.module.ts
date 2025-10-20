import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractReportsService } from './contract-reports.service';
import { ContractsMigrationService } from './contracts-migration.service';
import { ContractsController } from './contracts.controller';
import { ContractsMigrationController } from './contracts-migration.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Contract, ContractSchema } from './entities/contract.entity';
import {
  AccountingEntry,
  AccountingEntrySchema,
} from '../accounting-entries/entities/accounting-entry.entity';
import { AccountingEntriesModule } from '../accounting-entries/accounting-entries.module';
import { ChartOfAccountsModule } from '../chart-of-accounts/chart-of-accounts.module';
import { PropertiesModule } from '../properties/properties.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from 'src/common/common.module';
import { IndexValueModule } from '../external-apis/index-value/index-value.module';
import { ContractSettingsModule } from '../contract-settings/contract-settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contract.name, schema: ContractSchema },
      { name: AccountingEntry.name, schema: AccountingEntrySchema },
    ]),
    AccountingEntriesModule,
    ChartOfAccountsModule,
    PropertiesModule,
    AuthModule,
    CommonModule,
    IndexValueModule,
    ContractSettingsModule,
  ],

  controllers: [ContractsController, ContractsMigrationController],
  providers: [
    ContractsService,
    ContractReportsService,
    ContractsMigrationService,
  ],
  exports: [ContractsService],
})
export class ContractsModule {}
