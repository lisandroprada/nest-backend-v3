import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  Min,
} from 'class-validator';

export class InventoryItemSnapshotDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEnum(['Nuevo', 'Bueno', 'Regular', 'Malo'])
  @IsNotEmpty()
  estado: 'Nuevo' | 'Bueno' | 'Regular' | 'Malo';

  @IsNumber()
  @Min(1)
  cantidad: number;

  @IsString()
  @IsOptional()
  categoria?: string;

  @IsString()
  @IsOptional()
  marca?: string;

  @IsString()
  @IsOptional()
  modelo?: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fotos_urls?: string[];
}
