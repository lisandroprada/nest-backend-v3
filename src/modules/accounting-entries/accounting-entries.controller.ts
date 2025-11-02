import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { AccountingEntriesService } from './accounting-entries.service';
import { Auth } from '../auth/decorators/auth.decorators';
import { ValidRoles } from '../auth/interfaces/valid-roles.interface';
import { ApplyMoraBatchDto } from './dto/apply-mora-batch.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { MoraCandidatesQueryDto } from './dto/mora-candidates-query.dto';
import { PaginationDto } from 'src/common/pagination/dto/pagination.dto';
import { AccountingEntryFiltersDto } from './dto/accounting-entry-filters.dto';
import { AnularAsientoDto } from './dto/anular-asiento.dto';
import { CondonarAsientoDto } from './dto/condonar-asiento.dto';
import { LiquidarAsientoDto } from './dto/liquidar-asiento.dto';

@Controller('accounting-entries')
@Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.contabilidad)
export class AccountingEntriesController {
  constructor(
    private readonly accountingEntriesService: AccountingEntriesService,
  ) {}

  // ==================== GESTIÓN DE MORA ====================

  /**
   * GET /accounting-entries/mora-candidates
   * Obtiene una lista de asientos en mora que son candidatos para aplicar intereses.
   */
  @Get('mora-candidates')
  async getMoraCandidates(@Query() queryDto: MoraCandidatesQueryDto) {
    return this.accountingEntriesService.getMoraCandidates(queryDto);
  }

  /**
   * POST /accounting-entries/apply-mora
   * Aplica intereses a un lote de asientos en mora y genera los nuevos asientos de débito.
   */
  @Post('apply-mora')
  async applyMora(@Body() batchDto: ApplyMoraBatchDto) {
    return this.accountingEntriesService.applyMoraToBatch(batchDto);
  }

  // =========================================================

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
   * @summary Registra un pago para un asiento contable.
   * @description Este endpoint unificado maneja tanto pagos completos como parciales.
   * El backend determina si el pago es parcial o total basado en el monto enviado y el saldo pendiente del asiento.
   * Al recibir un pago, actualiza el estado del asiento a 'PAGADO_PARCIAL' o 'PAGADO' y registra la transacción en el historial del asiento para un seguimiento detallado.
   * @param id El ID del asiento contable que recibe el pago.
   * @param dto Un objeto con los detalles del pago, incluyendo el monto.
   * @returns El asiento contable actualizado con el nuevo estado y el historial de cambios.
   */
  @Post(':id/register-payment')
  async registerPayment(
    @Param('id') id: string,
    @Body() dto: RegisterPaymentDto,
  ) {
    return this.accountingEntriesService.registerPayment(id, dto);
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
