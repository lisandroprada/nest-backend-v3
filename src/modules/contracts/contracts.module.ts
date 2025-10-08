import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Contract, ContractSchema } from './entities/contract.entity';
import { AccountingEntriesModule } from '../accounting-entries/accounting-entries.module';
import { ChartOfAccountsModule } from '../chart-of-accounts/chart-of-accounts.module';
import { PropertiesModule } from '../properties/properties.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Contract.name, schema: ContractSchema }]),
    AccountingEntriesModule,
    ChartOfAccountsModule,
    PropertiesModule,
    AuthModule,
    CommonModule,
  ],

  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
