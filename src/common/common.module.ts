import { Module } from '@nestjs/common';
import { AxiosAdapter } from './adapters/axios.adapter';
import { PaginationService } from './pagination/pagination.service';
import { ErrorsService } from './errors/errors.service';
import { EmailModule } from './email/email.module';

@Module({
  imports: [EmailModule],
  providers: [AxiosAdapter, PaginationService, ErrorsService],
  exports: [AxiosAdapter, PaginationService, ErrorsService, EmailModule],
})
export class CommonModule {}
