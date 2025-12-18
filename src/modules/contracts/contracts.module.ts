import { AgentsModule } from '../agents/agents.module';
import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractReportsService } from './contract-reports.service';
import { ContractsMigrationService } from './contracts-migration.service';
// import { PaymentsMigrationService } from './payments-migration.service';
import { ContractsController } from './contracts.controller';
import { ContractsMigrationController } from './contracts-migration.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Contract, ContractSchema } from './entities/contract.entity';
import {
  AccountingEntry,
  AccountingEntrySchema,
} from '../accounting-entries/entities/accounting-entry.entity';
import { Property, PropertySchema } from '../properties/entities/property.entity';
import {
  LegacyAccountEntry,
  LegacyAccountEntrySchema,
} from './entities/legacy/legacy-account-entry.entity';
import {
  LegacyAccount,
  LegacyAccountSchema,
} from './entities/legacy/legacy-account.entity';
import {
  LegacyMasterAccount,
  LegacyMasterAccountSchema,
} from './entities/legacy/legacy-master-account.entity';
import { LegacyLeaseAgreement, LegacyLeaseAgreementSchema } from './entities/legacy/legacy-lease-agreement.entity';
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
      { name: Property.name, schema: PropertySchema },
    ]),
    MongooseModule.forFeature(
      [
        { name: LegacyAccountEntry.name, schema: LegacyAccountEntrySchema },
        { name: LegacyAccount.name, schema: LegacyAccountSchema },
        { name: LegacyMasterAccount.name, schema: LegacyMasterAccountSchema },
        { name: LegacyLeaseAgreement.name, schema: LegacyLeaseAgreementSchema },
      ],
      'LEGACY_DB',
    ),
    AccountingEntriesModule,
    ChartOfAccountsModule,
    PropertiesModule,
    AuthModule,
    CommonModule,
    IndexValueModule,
    ContractSettingsModule,
    AgentsModule,
  ],

  controllers: [ContractsController, ContractsMigrationController],
  providers: [
    ContractsService,
    ContractReportsService,
    ContractsMigrationService,
    // PaymentsMigrationService,
  ],
  exports: [ContractsService],
})
export class ContractsModule {}
