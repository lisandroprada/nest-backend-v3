import { Controller, Get, Query, Param } from '@nestjs/common';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id/parse-mongo-id.pipe';
import { Public } from '../auth/decorators/public.decorator';
import { PublicPropertiesService } from './public-properties.service';
import { PublicPropertyQueryDto } from './dto/public-property-query.dto';
import { MapQueryDto } from './dto/map-query.dto';

// Cambiar el controlador a 'public-properties' para evitar conflicto
// Las rutas quedan: /api/v1/public-properties
@Controller('public-properties')
export class PublicPropertiesController {
  constructor(
    private readonly publicPropertiesService: PublicPropertiesService,
  ) {}

  /**
   * Endpoint público para listar propiedades
   * Solo devuelve propiedades marcadas como públicas
   * GET /api/v1/public-properties
   */
  @Public()
  @Get()
  async findPublicProperties(@Query() queryDto: PublicPropertyQueryDto) {
    return this.publicPropertiesService.findPublicProperties(queryDto);
  }

  /**
   * Endpoint público para obtener una propiedad específica
   * GET /api/v1/public-properties/:id
   */
  @Public()
  @Get(':id')
  async findPublicProperty(@Param('id', ParseMongoIdPipe) id: string) {
    return this.publicPropertiesService.findPublicProperty(id);
  }

  /**
   * Endpoint optimizado para mapas
   * Devuelve solo los campos necesarios para marcadores en el mapa
   * GET /api/v1/public-properties/map
   */
  @Public()
  @Get('map')
  async findPropertiesForMap(@Query() queryDto: MapQueryDto) {
    return this.publicPropertiesService.findPropertiesForMap(queryDto);
  }
}
