import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ServiceAccountMappingsService } from './service-account-mappings.service';
import { CreateServiceAccountMappingDto } from './dto/create-service-account-mapping.dto';
import { UpdateServiceAccountMappingDto } from './dto/update-service-account-mapping.dto';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';

@Controller('service-account-mappings')
@Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.contabilidad)
export class ServiceAccountMappingsController {
  constructor(
    private readonly mappingsService: ServiceAccountMappingsService,
  ) {}

  @Post()
  create(@Body() createDto: CreateServiceAccountMappingDto) {
    // Debug: log incoming payload at controller level to inspect transformation
    // eslint-disable-next-line no-console
    console.debug(
      'Controller ServiceAccountMappings.create createDto:',
      createDto,
    );
    return this.mappingsService.create(createDto);
  }

  @Get()
  findAll() {
    return this.mappingsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mappingsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateServiceAccountMappingDto,
  ) {
    return this.mappingsService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mappingsService.remove(id);
  }
}
