import { Module } from '@nestjs/common';
import { FinancialAccountsService } from './financial-accounts.service';
import { FinancialAccountsController } from './financial-accounts.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  FinancialAccount,
  FinancialAccountSchema,
} from './entities/financial-account.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FinancialAccount.name, schema: FinancialAccountSchema },
    ]),
  ],
  controllers: [FinancialAccountsController],
  providers: [FinancialAccountsService],
  exports: [FinancialAccountsService],
})
export class FinancialAccountsModule {}
