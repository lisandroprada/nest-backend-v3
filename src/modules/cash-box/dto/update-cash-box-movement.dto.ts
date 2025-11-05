import { PartialType } from '@nestjs/mapped-types';
import { CreateCashBoxMovementDto } from './create-cash-box-movement.dto';

export class UpdateCashBoxMovementDto extends PartialType(
  CreateCashBoxMovementDto,
) {}
