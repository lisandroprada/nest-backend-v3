import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { LocalityService } from './locality.service';
import { CreateLocalityDto } from './dto/create-locality.dto';
import { UpdateLocalityDto } from './dto/update-locality.dto';
import { Auth } from 'src/modules/auth/decorators';
import { ValidRoles } from 'src/modules/auth/interfaces';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id/parse-mongo-id.pipe';

@Controller('locality')
export class LocalityController {
  constructor(private readonly localityService: LocalityService) {}

  @Post()
  create(@Body() createLocalityDto: CreateLocalityDto) {
    return this.localityService.create(createLocalityDto);
  }

  @Get()
  @Auth(ValidRoles.user, ValidRoles.admin, ValidRoles.superUser)
  findAll() {
    return this.localityService.findAll();
  }

  @Get('byId/:id')
  findByProvinceId(@Param('id', ParseMongoIdPipe) id: string) {
    return this.localityService.findByProvinceId(id);
  }

  @Get('byNumId/:id')
  async findByNumId(@Param('id') id: string, @Body('id') bodyId: string) {
    console.log({ bodyId });
    return await this.localityService.getLocalityByNumId(bodyId);
  }

  @Get('test-query')
  async testQuery(): Promise<any> {
    return await this.localityService.testQuery();
  }

  @Get('search')
  async searchByName(
    @Query('name') name: string,
    @Query('provinceId') provinceId: string,
  ) {
    // Búsqueda insensible a mayúsculas/minúsculas por nombre parcial y provincia
    return this.localityService.searchByNameAndProvince(name, provinceId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return await this.localityService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() updateLocalityDto: UpdateLocalityDto,
  ) {
    return this.localityService.update(id, updateLocalityDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.localityService.remove(+id);
  }

  @Post('fix-locality-id')
  fixLocality() {
    return this.localityService.updateLocalitiesWithProvinceId();
  }
}
