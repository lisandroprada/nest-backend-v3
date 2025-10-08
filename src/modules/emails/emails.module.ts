// src/modules/emails/emails.module.ts
import { Module } from '@nestjs/common';
import { EmailsController } from './emails.controller';
import { EmailsService } from './emails.service';
import { EmailModule } from '../../common/email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [EmailsController],
  providers: [EmailsService],
})
export class EmailsModule {}
