import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { AccountingEntriesService } from './accounting-entries.service';
import { Auth } from '../auth/decorators/auth.decorators';
import { ValidRoles } from '../auth/interfaces/valid-roles.interface';
import { ApplyMoraBatchDto } from './dto/apply-mora-batch.dto';
import { MoraCandidatesQueryDto } from './dto/mora-candidates-query.dto';
import { PaginationDto } from 'src/common/pagination/dto/pagination.dto';
import { AccountingEntryFiltersDto } from './dto/accounting-entry-filters.dto';
import { AnularAsientoDto } from './dto/anular-asiento.dto';
import { CondonarAsientoDto } from './dto/condonar-asiento.dto';
import { ProcessReceiptDto } from './dto/process-receipt.dto';
import { ProcessDetectedExpenseDto } from './dto/process-proposal.dto';

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
   * POST /accounting-entries/process-receipt
   * Endpoint unificado para procesar todas las operaciones de cobros y pagos.
   * Reemplaza los antiguos /register-payment y /liquidar.
   *
   * Ventajas:
   * - Una sola forma de registrar operaciones (1 o N)
   * - Genera comprobante único para todo el recibo
   * - Calcula movimiento neto automáticamente
   * - Soporta COBRO (DEBE) y PAGO (HABER) en la misma llamada
   *
   * Ejemplos de uso:
   * - Cobrar 1 alquiler: 1 línea tipo COBRO
   * - Liquidar 1 locador: 1 línea tipo PAGO
   * - Recibo completo: N líneas mezclando COBRO y PAGO
   */
  @Post('process-receipt')
  async processReceipt(@Body() dto: ProcessReceiptDto) {
    return this.accountingEntriesService.processReceipt(dto);
  }

  /**
   * POST /accounting-entries/process-detected-expense
   * Convierte una propuesta generada por `processDetectedUtilityInvoices` en un
   * asiento contable definitivo usando el mapeo proveedor->cuentas.
   */
  @Post('process-detected-expense')
  async processDetectedExpense(@Body() dto: ProcessDetectedExpenseDto) {
    return this.accountingEntriesService.processDetectedExpenseToEntry(dto);
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
   * GET /accounting-entries/:id/historial
   * Obtiene el historial de cambios de un asiento
   */
  @Get(':id/historial')
  async getHistorial(@Param('id') id: string) {
    return this.accountingEntriesService.getHistorialCambios(id);
  }
}
