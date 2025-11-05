import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemAdminService } from './system-admin.service';
import { SystemAdminController } from './system-admin.controller';
import {
  Contract,
  ContractSchema,
} from '../contracts/entities/contract.entity';
import {
  AccountingEntry,
  AccountingEntrySchema,
} from '../accounting-entries/entities/accounting-entry.entity';
import {
  Transaction,
  TransactionSchema,
} from '../transactions/entities/transaction.entity';
import { Receipt, ReceiptSchema } from '../receipts/entities/receipt.entity';
import {
  CashBoxMovement,
  CashBoxMovementSchema,
} from '../cash-box/entities/cash-box-movement.entity';
import {
  FinancialAccount,
  FinancialAccountSchema,
} from '../financial-accounts/entities/financial-account.entity';
import { Agent, AgentSchema } from '../agents/entities/agent.entity';
import {
  Property,
  PropertySchema,
} from '../properties/entities/property.entity';
import {
  ChartOfAccount,
  ChartOfAccountSchema,
} from '../chart-of-accounts/entities/chart-of-account.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contract.name, schema: ContractSchema },
      { name: AccountingEntry.name, schema: AccountingEntrySchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Receipt.name, schema: ReceiptSchema },
      { name: CashBoxMovement.name, schema: CashBoxMovementSchema },
      { name: FinancialAccount.name, schema: FinancialAccountSchema },
      { name: Agent.name, schema: AgentSchema },
      { name: Property.name, schema: PropertySchema },
      { name: ChartOfAccount.name, schema: ChartOfAccountSchema },
    ]),
    AuthModule,
  ],
  controllers: [SystemAdminController],
  providers: [SystemAdminService],
  exports: [SystemAdminService],
})
export class SystemAdminModule {}
