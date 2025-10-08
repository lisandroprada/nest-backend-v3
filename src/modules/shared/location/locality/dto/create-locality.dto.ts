import { IsNotEmpty, IsString, IsObject, IsOptional } from 'class-validator';

export class CreateLocalityDto {
  @IsNotEmpty()
  @IsString()
  readonly id: string;

  @IsNotEmpty()
  @IsString()
  readonly nombre: string;

  @IsOptional()
  @IsString()
  readonly fuente?: string;

  @IsNotEmpty()
  @IsObject()
  readonly provincia: {
    id: string;
    nombre: string;
  };

  @IsOptional()
  @IsObject()
  readonly departamento?: {
    id: string;
    nombre: string;
  };

  @IsOptional()
  @IsObject()
  readonly municipio?: {
    id: string;
    nombre: string;
  };

  @IsOptional()
  @IsObject()
  readonly localidad_censal?: {
    id: string;
    nombre: string;
  };

  @IsOptional()
  @IsString()
  readonly categoria?: string;

  @IsOptional()
  @IsObject()
  readonly centroide?: {
    lon: number;
    lat: number;
  };
}
