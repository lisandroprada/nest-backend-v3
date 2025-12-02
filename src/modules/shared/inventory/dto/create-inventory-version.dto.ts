import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InventoryItemSnapshotDto } from './inventory-item-snapshot.dto';

export class CreateInventoryVersionDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryItemSnapshotDto)
  @IsOptional()
  items?: InventoryItemSnapshotDto[];

  @IsEnum(['DRAFT', 'ACTIVE', 'ARCHIVED'])
  @IsOptional()
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}
