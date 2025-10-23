import { Module, forwardRef } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Transaction, TransactionSchema } from './entities/transaction.entity';
import { AccountingEntriesModule } from '../accounting-entries/accounting-entries.module';
import { AuthModule } from '../auth/auth.module';
import { ReceiptsModule } from '../receipts/receipts.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    AccountingEntriesModule,
    AuthModule,
    forwardRef(() => ReceiptsModule),
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
