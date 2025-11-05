import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FinancialReportsService } from './financial-reports.service';
import { FinancialReportQueryDto } from './dto/financial-report-query.dto';

@Controller('financial-reports')
@UseGuards(AuthGuard('jwt'))
export class FinancialReportsController {
  constructor(
    private readonly financialReportsService: FinancialReportsService,
  ) {}

  @Get('balance-sheet')
  async getBalanceSheet(@Query() query: FinancialReportQueryDto) {
    return this.financialReportsService.getBalanceSheet(query);
  }

  @Get('income-statement')
  async getIncomeStatement(@Query() query: FinancialReportQueryDto) {
    return this.financialReportsService.getIncomeStatement(query);
  }

  @Get('trial-balance')
  async getTrialBalance(@Query() query: FinancialReportQueryDto) {
    return this.financialReportsService.getTrialBalance(query);
  }

  @Get('cash-flow')
  async getCashFlow(@Query() query: FinancialReportQueryDto) {
    return this.financialReportsService.getCashFlow(query);
  }
}
