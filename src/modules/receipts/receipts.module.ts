import { Module, forwardRef } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { ReceiptsController } from './receipts.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Receipt, ReceiptSchema } from './entities/receipt.entity';
import { SequenceModule } from '../sequence/sequence.module';
import { AccountingEntriesModule } from '../accounting-entries/accounting-entries.module';
import { FinancialAccountsModule } from '../financial-accounts/financial-accounts.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { AuthModule } from '../auth/auth.module';
import { FiscalModule } from '../fiscal/fiscal.module';
import { ChartOfAccountsModule } from '../chart-of-accounts/chart-of-accounts.module';
import { AgentsModule } from '../agents/agents.module'; // Import AgentsModule

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Receipt.name, schema: ReceiptSchema }]),
    SequenceModule,
    AccountingEntriesModule,
    FinancialAccountsModule,
    forwardRef(() => TransactionsModule),
    AuthModule,
    FiscalModule,
    ChartOfAccountsModule,
    AgentsModule, // Add AgentsModule here
  ],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
