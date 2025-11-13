import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { CreateSystemConfigDto } from './dto/create-system-config.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';

@Controller('config/email')
@Auth(ValidRoles.admin, ValidRoles.superUser)
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  /**
   * Crear la configuración inicial del sistema
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreateSystemConfigDto) {
    return this.systemConfigService.create(createDto);
  }

  /**
   * Obtener la configuración actual (sin mostrar contraseña real)
   */
  @Get()
  async findOne() {
    return this.systemConfigService.findOne();
  }

  /**
   * Actualizar la configuración del sistema
   */
  @Patch()
  async update(@Body() updateDto: UpdateSystemConfigDto) {
    return this.systemConfigService.update(updateDto);
  }

  /**
   * Probar la conexión IMAP con las credenciales configuradas
   */
  @Get('test')
  async testConnection() {
    // TODO: Implementar prueba de conexión IMAP
    // Esta funcionalidad se implementará en el RedlinkScanService
    return {
      status: 'pending',
      message: 'Funcionalidad de test pendiente de implementación',
    };
  }
}
