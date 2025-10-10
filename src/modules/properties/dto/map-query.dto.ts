import { IsOptional, IsNumber, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class MapQueryDto {
  @IsEnum(['venta', 'alquiler'])
  @IsOptional()
  tipo?: 'venta' | 'alquiler';

  @IsNumber()
  @Type(() => Number)
  @Min(-90)
  @Max(90)
  minLat: number;

  @IsNumber()
  @Type(() => Number)
  @Min(-90)
  @Max(90)
  maxLat: number;

  @IsNumber()
  @Type(() => Number)
  @Min(-180)
  @Max(180)
  minLng: number;

  @IsNumber()
  @Type(() => Number)
  @Min(-180)
  @Max(180)
  maxLng: number;

  @IsEnum(['COMERCIAL', 'VIVIENDA', 'INDUSTRIAL', 'MIXTO'])
  @IsOptional()
  proposito?: string;
}
