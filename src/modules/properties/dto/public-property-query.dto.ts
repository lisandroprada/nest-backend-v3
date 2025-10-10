import { IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from 'src/common/pagination/dto/pagination.dto';

export class PublicPropertyQueryDto extends PaginationDto {
  @IsEnum(['venta', 'alquiler'])
  @IsOptional()
  tipo?: 'venta' | 'alquiler';

  @IsEnum(['COMERCIAL', 'VIVIENDA', 'INDUSTRIAL', 'MIXTO'])
  @IsOptional()
  proposito?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  @Min(-90)
  @Max(90)
  minLat?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  @Min(-90)
  @Max(90)
  maxLat?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  @Min(-180)
  @Max(180)
  minLng?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  @Min(-180)
  @Max(180)
  maxLng?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  minPrecio?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  maxPrecio?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  dormitorios?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  banos?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  ambientes?: number;
}
