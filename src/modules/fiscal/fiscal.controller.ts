import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { FiscalDocumentsService } from './fiscal-documents.service';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { GetUser } from '../auth/decorators';
import { User } from '../user/entities/user.entity';

@Controller('fiscal')
@Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.contabilidad)
export class FiscalController {
  constructor(private readonly fiscalDocumentsService: FiscalDocumentsService) {}

  @Post('invoices/issue')
  issueInvoice(@Body() issueDto: IssueInvoiceDto, @GetUser() user: User) {
    return this.fiscalDocumentsService.issueInvoice(issueDto, user._id.toString());
  }

  // Other endpoints from the specification can be added here...
}
