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
import { ProvinceService } from './province.service';
import { CreateProvinceDto } from './dto/create-province.dto';
import { UpdateProvinceDto } from './dto/update-province.dto';
import { Auth } from 'src/modules/auth/decorators';
import { ValidRoles } from 'src/modules/auth/interfaces';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id/parse-mongo-id.pipe';

@Controller('province')
export class ProvinceController {
  constructor(private readonly provinceService: ProvinceService) {}

  @Post()
  create(@Body() createProvinceDto: CreateProvinceDto) {
    return this.provinceService.create(createProvinceDto);
  }

  @Get()
  @Auth(ValidRoles.user)
  findAll(@Query('populate') populate?: string) {
    return this.provinceService.findAll(populate);
  }

  @Get('search')
  async searchByName(
    @Query('name') name: string,
    @Query('populate') populate?: string,
  ) {
    return this.provinceService.searchByName(name, populate);
  }

  // Obtener provincia por _id (MongoID)
  @Get(':id')
  async findOne(
    @Param('id', ParseMongoIdPipe) id: string,
    @Query('populate') populate?: string,
  ) {
    return await this.provinceService.findById(id, populate);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProvinceDto: UpdateProvinceDto,
  ) {
    return this.provinceService.update(+id, updateProvinceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.provinceService.remove(+id);
  }
}
