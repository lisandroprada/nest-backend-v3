import { Controller, Post, Get, Body } from '@nestjs/common';
import { SystemAdminService } from './system-admin.service';
import { ResetSystemDto, ResetSystemResponseDto } from './dto/reset-system.dto';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';

@Controller('system-admin')
@Auth(ValidRoles.admin, ValidRoles.superUser)
export class SystemAdminController {
  constructor(private readonly systemAdminService: SystemAdminService) {}

  /**
   * POST /system-admin/reset
   *
   * Resetea el sistema eliminando todos los datos operacionales:
   * - Contratos
   * - Asientos contables
   * - Transacciones
   * - Recibos
   * - Movimientos de caja
   * - Resetea saldos de cuentas financieras
   *
   * Mantiene intactos:
   * - Plan de cuentas
   * - Agentes
   * - Propiedades
   * - Usuarios
   * - Configuraciones
   *
   * Body:
   * {
   *   "confirm": true,
   *   "dryRun": false  // opcional: true para simular sin eliminar
   * }
   */
  @Post('reset')
  async resetSystem(
    @Body() resetSystemDto: ResetSystemDto,
  ): Promise<ResetSystemResponseDto> {
    return this.systemAdminService.resetSystem(resetSystemDto);
  }

  /**
   * GET /system-admin/stats
   *
   * Obtiene estadísticas del sistema actual
   */
  @Get('stats')
  async getStats(): Promise<any> {
    return this.systemAdminService.getSystemStats();
  }
}
