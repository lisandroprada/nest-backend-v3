import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { DetectedExpensesService } from './detected-expenses.service';
import { CreateDetectedExpenseDto } from './dto/create-detected-expense.dto';
import { UpdateDetectedExpenseDto } from './dto/update-detected-expense.dto';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';

@Controller('detected-expenses')
@Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.contabilidad)
export class DetectedExpensesController {
  constructor(
    private readonly detectedExpensesService: DetectedExpensesService,
  ) {}

  @Post()
  create(@Body() createDto: CreateDetectedExpenseDto) {
    return this.detectedExpensesService.create(createDto);
  }

  @Get()
  findAll() {
    return this.detectedExpensesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.detectedExpensesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateDetectedExpenseDto) {
    return this.detectedExpensesService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.detectedExpensesService.remove(id);
  }
}
