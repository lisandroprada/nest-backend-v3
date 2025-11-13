import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BankingSyncService } from './banking-sync.service';
import { RedlinkScanService } from './redlink-scan.service';
import { ConciliationService } from './conciliation.service';
import { BankMovementQueryDto } from './dto/bank-movement-query.dto';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { SystemConfigService } from '../system-config/system-config.service';

@Controller('bank-sync')
@Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.contabilidad)
export class BankingSyncController {
  constructor(
    private readonly bankingSyncService: BankingSyncService,
    private readonly redlinkScanService: RedlinkScanService,
    private readonly systemConfigService: SystemConfigService,
    private readonly conciliationService: ConciliationService,
  ) {}

  /**
   * Lista movimientos bancarios externos con paginación y filtros
   */
  @Get()
  async findAll(@Query() query: BankMovementQueryDto) {
    return this.bankingSyncService.findAll(query);
  }

  /**
   * Health check completo del módulo de banking sync
   * Devuelve estado de configuración, conexión IMAP, última consulta y stats
   */
  @Get('health')
  async health() {
    let configPresent = false;
    let lastCheckAt: string | null = null;
    let imapConnectionStatus: 'success' | 'failed' | 'not-tested' =
      'not-tested';
    let isScanning = false;

    try {
      const config = await this.systemConfigService.findOne();
      configPresent = !!config;
      lastCheckAt = config?.fecha_ultima_consulta
        ? config.fecha_ultima_consulta.toISOString()
        : null;
    } catch {
      configPresent = false;
    }

    // Test de conexión IMAP (opcional, se puede hacer más liviano solo verificando config)
    try {
      const imapConnected = await this.redlinkScanService.testConnection();
      imapConnectionStatus = imapConnected ? 'success' : 'failed';
    } catch {
      imapConnectionStatus = 'failed';
    }

    // Verificar si hay escaneo en progreso (acceso a propiedad privada via reflexión o flag público)
    isScanning = (this.redlinkScanService as any).isScanning || false;

    // Obtener estadísticas de conciliación
    const stats = await this.bankingSyncService.getStats();

    return {
      configPresent,
      lastCheckAt,
      imapConnection: imapConnectionStatus,
      isScanning,
      stats: {
        totalMovements: stats.total,
        conciliated: stats.conciliados,
        pending: stats.pendientes,
        conciliationRate: stats.porcentaje_conciliacion,
      },
    };
  }

  /**
   * Obtiene estadísticas de conciliación bancaria
   */
  @Get('stats/overview')
  async getStats() {
    return this.bankingSyncService.getStats();
  }

  /**
   * Prueba la conexión IMAP
   */
  @Get('test/connection')
  async testConnection() {
    const isConnected = await this.redlinkScanService.testConnection();
    return {
      status: isConnected ? 'success' : 'failed',
      message: isConnected
        ? 'Conexión IMAP exitosa'
        : 'Error al conectar con el servidor IMAP',
    };
  }

  /**
   * Lista candidatos (se puede filtrar por status o movimiento)
   */
  @Get('candidates')
  async listCandidates(@Query() query: any) {
    return this.conciliationService.listCandidates(query);
  }

  /**
   * Obtiene un movimiento bancario por ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.bankingSyncService.findOne(id);
  }

  /**
   * Fuerza un escaneo manual de emails
   */
  @Post('rescan')
  @HttpCode(HttpStatus.OK)
  async rescan() {
    const result = await this.redlinkScanService.scanEmails();
    return {
      message: 'Escaneo de emails completado',
      ...result,
    };
  }

  /**
   * Genera candidatos de conciliación (no confirma automáticamente)
   */
  @Post('candidates/generate')
  async generateCandidates(@Query() query: any) {
    return this.conciliationService.generateCandidates(query);
  }

  /**
   * Actualiza estado de candidato (CONFIRMED / REJECTED)
   */
  @Post('candidates/status')
  async updateCandidateStatus(@Body() body: any) {
    return this.conciliationService.updateCandidateStatus(body);
  }
}
