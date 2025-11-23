import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Patch,
  Delete,
} from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { Auth, GetUser } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PaginationDto } from 'src/common/pagination/dto/pagination.dto';
import { User } from '../user/entities/user.entity';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id/parse-mongo-id.pipe';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get('by-medidor/:identificador_servicio')
  async findByMedidor(
    @Param('identificador_servicio') identificador_servicio: string,
  ) {
    return this.propertiesService.findByMedidor(identificador_servicio);
  }
  @Post()
  @Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.agente)
  async create(
    @Body() createPropertyDto: CreatePropertyDto,
    @GetUser() user: User,
  ) {
    return this.propertiesService.create(
      createPropertyDto,
      user._id.toString(),
    );
  }

  @Get()
  @Auth(
    ValidRoles.admin,
    ValidRoles.superUser,
    ValidRoles.agente,
    ValidRoles.contabilidad,
  )
  async findAll(@Query() paginationDto: PaginationDto) {
    return this.propertiesService.findAll(paginationDto);
  }

  @Get(':id')
  @Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.agente)
  async findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return this.propertiesService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.agente)
  async update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
    @GetUser() user: User,
  ) {
    return this.propertiesService.update(
      id,
      updatePropertyDto,
      user._id.toString(),
    );
  }

  @Delete(':id')
  @Auth(ValidRoles.superUser)
  async remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.propertiesService.remove(id);
  }
}
