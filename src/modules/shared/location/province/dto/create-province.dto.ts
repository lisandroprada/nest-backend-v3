import { IsNotEmpty, IsString, IsOptional, IsObject } from 'class-validator';

export class CreateProvinceDto {
  @IsNotEmpty()
  @IsString()
  readonly id: string;

  @IsNotEmpty()
  @IsString()
  readonly nombre: string;

  @IsOptional()
  @IsString()
  readonly nombre_completo?: string;

  @IsOptional()
  @IsString()
  readonly fuente?: string;

  @IsOptional()
  @IsString()
  readonly categoria?: string;

  @IsOptional()
  @IsObject()
  readonly centroide?: {
    lon: number;
    lat: number;
  };

  @IsOptional()
  @IsString()
  readonly iso_id?: string;

  @IsOptional()
  @IsString()
  readonly iso_nombre?: string;
}
