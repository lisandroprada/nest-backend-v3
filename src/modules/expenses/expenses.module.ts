import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { AuthModule } from '../auth/auth.module';
import { DetectedExpensesModule } from '../detected-expenses/detected-expenses.module';
import { AccountingEntriesModule } from '../accounting-entries/accounting-entries.module';

@Module({
  imports: [AuthModule, DetectedExpensesModule, AccountingEntriesModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}
