import { IsOptional, IsString, IsNumber, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchPropertiesDto {
  @IsIn(['rent', 'sale'])
  operation: 'rent' | 'sale';

  @IsOptional()
  @IsIn(['departamento', 'casa', 'ph', 'oficina', 'local_comercial', 'duplex', 'loft'])
  type?: string;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;
}
