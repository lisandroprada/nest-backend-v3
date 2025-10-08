import { Controller, Get, Query, Param } from '@nestjs/common';
import { AccountingEntriesService } from './accounting-entries.service';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { PaginationDto } from 'src/common/pagination/dto/pagination.dto';

@Controller('accounting-entries')
@Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.contabilidad)
export class AccountingEntriesController {
  constructor(
    private readonly accountingEntriesService: AccountingEntriesService,
  ) {}

  @Get()
  async findAll(@Query() paginationDto: PaginationDto) {
    return this.accountingEntriesService.findAll(paginationDto);
  }

  @Get('agent/:agentId/details')
  async getEntriesByAgent(
    @Param('agentId') agentId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.accountingEntriesService.findEntriesDetailByAgent(
      agentId,
      paginationDto,
    );
  }

  @Get('reports/aging')
  async getAgingReport(@Query() queryParams: any) {
    return this.accountingEntriesService.getAgingReport(queryParams);
  }

  @Get('reports/income')
  async getAccruedIncome(@Query() queryParams: any) {
    return this.accountingEntriesService.getAccruedIncome(queryParams);
  }
}
