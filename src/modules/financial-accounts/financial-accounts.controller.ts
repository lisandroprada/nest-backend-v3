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
import { FinancialAccountsService } from './financial-accounts.service';
import { CreateFinancialAccountDto } from './dto/create-financial-account.dto';
import { UpdateFinancialAccountDto } from './dto/update-financial-account.dto';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id/parse-mongo-id.pipe';
import { MovementsQueryDto } from './dto/movements-query.dto';

@Controller('financial-accounts')
export class FinancialAccountsController {
  constructor(
    private readonly financialAccountsService: FinancialAccountsService,
  ) {}

  @Post()
  create(@Body() createFinancialAccountDto: CreateFinancialAccountDto) {
    return this.financialAccountsService.create(createFinancialAccountDto);
  }

  @Get()
  findAll() {
    return this.financialAccountsService.findAll();
  }

  /**
   * GET /financial-accounts/movements
   * Obtiene los movimientos (transacciones) de cuentas financieras
   * con paginación y filtros por fecha, tipo, cuenta, etc.
   */
  @Get('movements')
  getMovements(@Query() query: MovementsQueryDto) {
    return this.financialAccountsService.getMovements(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return this.financialAccountsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() updateFinancialAccountDto: UpdateFinancialAccountDto,
  ) {
    return this.financialAccountsService.update(id, updateFinancialAccountDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.financialAccountsService.remove(id);
  }
}
