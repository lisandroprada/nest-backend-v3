import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DetectedExpensesService } from './detected-expenses.service';
import { DetectedExpensesController } from './detected-expenses.controller';
import {
  DetectedExpense,
  DetectedExpenseSchema,
} from './entities/detected-expense.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: DetectedExpense.name,
        schema: DetectedExpenseSchema,
        collection: 'gastos_detectados',
      },
    ]),
    AuthModule,
  ],
  controllers: [DetectedExpensesController],
  providers: [DetectedExpensesService],
  exports: [DetectedExpensesService],
})
export class DetectedExpensesModule {}
