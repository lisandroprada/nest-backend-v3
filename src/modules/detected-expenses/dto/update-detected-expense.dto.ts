import { PartialType } from '@nestjs/mapped-types';
import { CreateDetectedExpenseDto } from './create-detected-expense.dto';

export class UpdateDetectedExpenseDto extends PartialType(CreateDetectedExpenseDto) {}
