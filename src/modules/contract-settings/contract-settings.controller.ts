import { Controller, Get, Patch, Body, Param } from '@nestjs/common';
import { ContractSettingsService } from './contract-settings.service';
import { UpdateContractSettingsDto } from './dto/update-contract-settings.dto';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { GetUser } from '../auth/decorators';
import { User } from '../user/entities/user.entity';
import { UpdateHonorariosTipoDto } from './dto/update-honorarios-tipo.dto';

@Controller('contract-settings')
export class ContractSettingsController {
  constructor(
    private readonly contractSettingsService: ContractSettingsService,
  ) {}

  /**
   * GET /contract-settings
   * Obtiene la configuración general de contratos
   * Acceso: admin, superUser, contabilidad, agente
   */
  @Get()
  @Auth(
    ValidRoles.admin,
    ValidRoles.superUser,
    ValidRoles.contabilidad,
    ValidRoles.agente,
  )
  async getSettings() {
    return this.contractSettingsService.getSettings();
  }

  /**
   * GET /contract-settings/tipo/:tipoContrato
   * Obtiene configuración específica para un tipo de contrato
   * Acceso: admin, superUser, contabilidad, agente
   *
   * Tipos disponibles:
   * - VIVIENDA_UNICA
   * - VIVIENDA
   * - COMERCIAL
   * - TEMPORARIO
   * - OTROS
   */
  @Get('tipo/:tipoContrato')
  @Auth(
    ValidRoles.admin,
    ValidRoles.superUser,
    ValidRoles.contabilidad,
    ValidRoles.agente,
  )
  async getSettingsByTipo(@Param('tipoContrato') tipoContrato: string) {
    return this.contractSettingsService.getSettingsByTipoContrato(
      tipoContrato.toUpperCase(),
    );
  }

  /**
   * PATCH /contract-settings/tipo/:tipoContrato/honorarios
   * Actualiza overrides de honorarios para un tipo de contrato
   * Acceso: admin, superUser
   */
  @Patch('tipo/:tipoContrato/honorarios')
  @Auth(ValidRoles.admin, ValidRoles.superUser)
  async updateHonorariosTipo(
    @Param('tipoContrato') tipoContrato: string,
    @Body() body: UpdateHonorariosTipoDto,
    @GetUser() user: User,
  ) {
    return this.contractSettingsService.updateHonorariosForTipo(
      tipoContrato.toUpperCase(),
      body,
      user._id.toString(),
    );
  }

  /**
   * PATCH /contract-settings
   * Actualiza la configuración de contratos
   * Acceso: admin, superUser
   */
  @Patch()
  @Auth(ValidRoles.admin, ValidRoles.superUser)
  async updateSettings(
    @Body() updateDto: UpdateContractSettingsDto,
    @GetUser() user: User,
  ) {
    return this.contractSettingsService.updateSettings(
      updateDto,
      user._id.toString(),
    );
  }

  /**
   * PATCH /contract-settings/reset
   * Resetea la configuración a valores por defecto
   * Acceso: admin, superUser
   */
  @Patch('reset')
  @Auth(ValidRoles.admin, ValidRoles.superUser)
  async resetToDefaults(@GetUser() user: User) {
    return this.contractSettingsService.resetToDefaults(user._id.toString());
  }
}
