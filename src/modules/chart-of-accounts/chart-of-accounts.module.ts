import { Module } from '@nestjs/common';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { ChartOfAccountsController } from './chart-of-accounts.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ChartOfAccount,
  ChartOfAccountSchema,
} from './entities/chart-of-account.entity';
import { PaginationService } from 'src/common/pagination/pagination.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChartOfAccount.name, schema: ChartOfAccountSchema },
    ]),
  ],
  controllers: [ChartOfAccountsController],
  providers: [ChartOfAccountsService, PaginationService],
  exports: [ChartOfAccountsService],
})
export class ChartOfAccountsModule {}
