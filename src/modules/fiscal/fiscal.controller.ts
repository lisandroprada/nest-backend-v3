import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { FiscalDocumentsService } from './fiscal-documents.service';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { GetUser } from '../auth/decorators';
import { User } from '../user/entities/user.entity';
import { FiscalReportsService } from './fiscal-reports.service';

@Controller('fiscal')
@Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.contabilidad)
export class FiscalController {
  constructor(
    private readonly fiscalDocumentsService: FiscalDocumentsService,
    private readonly fiscalReportsService: FiscalReportsService,
  ) {}

  @Post('invoices/issue')
  issueInvoice(@Body() issueDto: IssueInvoiceDto, @GetUser() user: User) {
    return this.fiscalDocumentsService.issueInvoice(
      issueDto,
      user._id.toString(),
    );
  }

  @Get('reports/billing-summary')
  getBillingSummary(@Query('months') months: string) {
    return this.fiscalReportsService.getBillingSummary(
      parseInt(months, 10) || 12,
    );
  }

  // Other endpoints from the specification can be added here...
}
