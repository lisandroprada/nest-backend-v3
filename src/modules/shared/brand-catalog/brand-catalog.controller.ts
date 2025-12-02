import {Controller, Get, Post, Body, Patch, Param, Delete, Query} from '@nestjs/common';
import {BrandCatalogService} from './brand-catalog.service';
import {CreateBrandCatalogDto} from './dto/create-brand-catalog.dto';
import {UpdateBrandCatalogDto} from './dto/update-brand-catalog.dto';
import {LearnCatalogDto} from './dto/learn-catalog.dto';
import {Auth} from '../../auth/decorators/auth.decorators';
import {ValidRoles} from '../../auth/interfaces';

@Controller('brand-catalog')
export class BrandCatalogController {
  constructor(private readonly brandCatalogService: BrandCatalogService) {}

  // Endpoints públicos (no requieren autenticación)

  @Get('categories')
  async getCategories() {
    return this.brandCatalogService.getCategories();
  }

  @Get('brands')
  async getBrands(@Query('categoria') categoria: string) {
    if (!categoria) {
      return [];
    }
    return this.brandCatalogService.getBrands(categoria);
  }

  @Get('items')
  async getCommonItems(@Query('categoria') categoria: string) {
    if (!categoria) {
      return [];
    }
    return this.brandCatalogService.getCommonItems(categoria);
  }

  @Get('suggestions')
  async getSuggestions(@Query('q') query: string) {
    if (!query || query.length < 2) {
      return {marcas: [], items: [], categorias: []};
    }
    return this.brandCatalogService.getSuggestions(query);
  }

  @Get('models/:categoria/:marca')
  async getModels(
    @Param('categoria') categoria: string,
    @Param('marca') marca: string,
  ) {
    return this.brandCatalogService.getModels(categoria, marca);
  }

  @Post('learn')
  async learn(@Body() dto: LearnCatalogDto) {
    await this.brandCatalogService.learnFromInput(dto);
    return {message: 'Aprendizaje registrado correctamente'};
  }

  // Endpoints administrativos (requieren autenticación)

  @Post()
  @Auth(ValidRoles.admin, ValidRoles.superUser)
  async create(@Body() createDto: CreateBrandCatalogDto) {
    return this.brandCatalogService.create(createDto);
  }

  @Get()
  @Auth(ValidRoles.admin, ValidRoles.superUser)
  async findAll() {
    return this.brandCatalogService.findAll();
  }

  @Get(':id')
  @Auth(ValidRoles.admin, ValidRoles.superUser)
  async findOne(@Param('id') id: string) {
    return this.brandCatalogService.findByCategoria(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.admin, ValidRoles.superUser)
  async update(@Param('id') id: string, @Body() updateDto: UpdateBrandCatalogDto) {
    return this.brandCatalogService.update(id, updateDto);
  }

  @Delete(':id')
  @Auth(ValidRoles.admin, ValidRoles.superUser)
  async remove(@Param('id') id: string) {
    await this.brandCatalogService.remove(id);
    return {message: 'Catálogo eliminado correctamente'};
  }

  @Post('seed')
  @Auth(ValidRoles.admin, ValidRoles.superUser)
  async seed() {
    await this.brandCatalogService.seedDatabase();
    return {message: 'Base de datos poblada correctamente'};
  }
}
