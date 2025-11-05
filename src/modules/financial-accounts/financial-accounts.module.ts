import { Module } from '@nestjs/common';
import { FinancialAccountsService } from './financial-accounts.service';
import { FinancialAccountsController } from './financial-accounts.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  FinancialAccount,
  FinancialAccountSchema,
} from './entities/financial-account.entity';
import {
  Transaction,
  TransactionSchema,
} from '../transactions/entities/transaction.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FinancialAccount.name, schema: FinancialAccountSchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
  controllers: [FinancialAccountsController],
  providers: [FinancialAccountsService],
  exports: [FinancialAccountsService],
})
export class FinancialAccountsModule {}
