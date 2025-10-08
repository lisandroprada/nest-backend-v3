import { Module } from '@nestjs/common';
import { AccountingEntriesService } from './accounting-entries.service';
import { AccountingEntriesController } from './accounting-entries.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AccountingEntry,
  AccountingEntrySchema,
} from './entities/accounting-entry.entity';
import { CommonModule } from 'src/common/common.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AccountingEntry.name, schema: AccountingEntrySchema },
    ]),
    CommonModule,
    AuthModule,
  ],
  controllers: [AccountingEntriesController],
  providers: [AccountingEntriesService],
  exports: [AccountingEntriesService],
})
export class AccountingEntriesModule {}
