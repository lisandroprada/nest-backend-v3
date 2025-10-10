import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ValuationsService } from './valuations.service';
import { CreateValuationDto } from './dto/create-valuation.dto';
import { UpdateValuationDto } from './dto/update-valuation.dto';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { GetUser } from '../auth/decorators';
import { User } from '../user/entities/user.entity';

@Controller('valuations')
@Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.contabilidad)
export class ValuationsController {
  constructor(private readonly valuationsService: ValuationsService) {}

  @Post()
  create(@Body() createDto: CreateValuationDto, @GetUser() user: User) {
    return this.valuationsService.create(createDto, user._id.toString());
  }

  @Get()
  findAll() {
    return this.valuationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.valuationsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateValuationDto) {
    return this.valuationsService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.valuationsService.remove(id);
  }

  @Post(':id/generate-pdf')
  generateReportAndSend(@Param('id') id: string) {
    return this.valuationsService.generateReportAndSend(id);
  }
}
