import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { CreateChartOfAccountDto } from './dto/create-chart-of-account.dto';
import { UpdateChartOfAccountDto } from './dto/update-chart-of-account.dto';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id/parse-mongo-id.pipe';
import { PaginationDto } from 'src/common/pagination/dto/pagination.dto';

@Controller('chart-of-accounts')
export class ChartOfAccountsController {
  constructor(
    private readonly chartOfAccountsService: ChartOfAccountsService,
  ) {}

  @Post()
  create(@Body() createChartOfAccountDto: CreateChartOfAccountDto) {
    return this.chartOfAccountsService.create(createChartOfAccountDto);
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.chartOfAccountsService.findAll(paginationDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return this.chartOfAccountsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() updateChartOfAccountDto: UpdateChartOfAccountDto,
  ) {
    return this.chartOfAccountsService.update(id, updateChartOfAccountDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.chartOfAccountsService.remove(id);
  }
}
