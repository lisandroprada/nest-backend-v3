import { PartialType } from '@nestjs/mapped-types';
import { CreateInventoryVersionDto } from './create-inventory-version.dto';

export class UpdateInventoryVersionDto extends PartialType(
  CreateInventoryVersionDto,
) {}
