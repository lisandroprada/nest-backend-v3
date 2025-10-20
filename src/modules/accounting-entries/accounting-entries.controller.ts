import { Controller, Get, Query, Param, Post, Body } from '@nestjs/common';
import { AccountingEntriesService } from './accounting-entries.service';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { PaginationDto } from 'src/common/pagination/dto/pagination.dto';
import { PagarAsientoDto } from './dto/pagar-asiento.dto';
import { PagoParcialDto } from './dto/pago-parcial.dto';
import { AnularAsientoDto } from './dto/anular-asiento.dto';
import { CondonarAsientoDto } from './dto/condonar-asiento.dto';
import { LiquidarAsientoDto } from './dto/liquidar-asiento.dto';
import { AccountingEntryFiltersDto } from './dto/accounting-entry-filters.dto';

@Controller('accounting-entries')
@Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.contabilidad)
export class AccountingEntriesController {
  constructor(
    private readonly accountingEntriesService: AccountingEntriesService,
  ) {}

  /**
   * GET /accounting-entries
   * Lista asientos contables sin filtros avanzados (método antiguo)
   */
  @Get()
  async findAll(@Query() paginationDto: PaginationDto) {
    return this.accountingEntriesService.findAll(paginationDto);
  }

  /**
   * GET /accounting-entries/search
   * Busca asientos contables con filtros avanzados
   */
  @Get('search')
  async searchWithFilters(@Query() filters: AccountingEntryFiltersDto) {
    return this.accountingEntriesService.findWithFilters(filters);
  }

  /**
   * GET /accounting-entries/estado-cuenta/:agentId
   * Obtiene el estado de cuenta de un agente específico
   * TODO: Implementar getEstadoCuentaByAgente en el servicio (Fase 2)
   */
  @Get('estado-cuenta/:agentId')
  async getEstadoCuenta(
    @Param('agentId') agentId: string,
    @Query() filters: any,
  ) {
    return this.accountingEntriesService.getEstadoCuentaByAgente(
      agentId,
      filters,
    );
  }

  /**
   * GET /accounting-entries/resumen-global
   * Obtiene resumen global del sistema contable
   * TODO: Implementar getResumenGlobal en el servicio (Fase 2)
   */
  // @Get('resumen-global')
  // async getResumenGlobal(@Query() filters: ResumenGlobalFiltersDto) {
  //   return this.accountingEntriesService.getResumenGlobal(filters);
  // }

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

  // ==================== FASE 3: ACCIONES SOBRE ASIENTOS ====================

  /**
   * POST /accounting-entries/:id/pagar
   * Marca un asiento como pagado (completo)
   */
  @Post(':id/pagar')
  async pagarAsiento(@Param('id') id: string, @Body() dto: PagarAsientoDto) {
    return this.accountingEntriesService.marcarComoPagado(id, dto);
  }

  /**
   * POST /accounting-entries/:id/pago-parcial
   * Registra un pago parcial
   */
  @Post(':id/pago-parcial')
  async pagarParcial(@Param('id') id: string, @Body() dto: PagoParcialDto) {
    return this.accountingEntriesService.registrarPagoParcial(id, dto);
  }

  /**
   * POST /accounting-entries/:id/anular
   * Anula un asiento contable
   */
  @Post(':id/anular')
  async anularAsiento(@Param('id') id: string, @Body() dto: AnularAsientoDto) {
    return this.accountingEntriesService.anularAsiento(id, dto);
  }

  /**
   * POST /accounting-entries/:id/condonar
   * Condona una deuda (total o parcial)
   */
  @Post(':id/condonar')
  async condonarDeuda(
    @Param('id') id: string,
    @Body() dto: CondonarAsientoDto,
  ) {
    return this.accountingEntriesService.condonarDeuda(id, dto);
  }

  /**
   * POST /accounting-entries/:id/liquidar
   * Liquida un asiento al propietario
   */
  @Post(':id/liquidar')
  async liquidarAPropietario(
    @Param('id') id: string,
    @Body() dto: LiquidarAsientoDto,
  ) {
    return this.accountingEntriesService.liquidarAPropietario(id, dto);
  }

  /**
   * GET /accounting-entries/:id/historial
   * Obtiene el historial de cambios de un asiento
   */
  @Get(':id/historial')
  async getHistorial(@Param('id') id: string) {
    return this.accountingEntriesService.getHistorialCambios(id);
  }
}
