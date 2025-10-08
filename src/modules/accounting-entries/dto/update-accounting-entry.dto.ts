import { PartialType } from '@nestjs/mapped-types';
import { CreateAccountingEntryDto } from './create-accounting-entry.dto';

export class UpdateAccountingEntryDto extends PartialType(
  CreateAccountingEntryDto,
) {}
