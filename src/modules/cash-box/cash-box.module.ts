import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CashBoxService } from './cash-box.service';
import { CashBoxController } from './cash-box.controller';
import {
  CashBoxMovement,
  CashBoxMovementSchema,
} from './entities/cash-box-movement.entity';
import { FinancialAccountsModule } from '../financial-accounts/financial-accounts.module';
import { AccountingEntriesModule } from '../accounting-entries/accounting-entries.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CashBoxMovement.name, schema: CashBoxMovementSchema },
    ]),
    FinancialAccountsModule,
    AccountingEntriesModule,
  ],
  controllers: [CashBoxController],
  providers: [CashBoxService],
})
export class CashBoxModule {}
