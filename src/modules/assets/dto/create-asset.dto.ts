import { IsString, IsNotEmpty, IsMongoId, IsOptional, IsDateString, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class HistorialEstadoDto {
  @IsDateString()
  @IsNotEmpty()
  fecha: string;

  @IsString()
  @IsNotEmpty()
  estado_item: string;

  @IsMongoId()
  @IsOptional()
  contrato_id?: string;

  @IsString()
  @IsOptional()
  observaciones?: string;
}

export class CreateAssetDto {
  @IsMongoId()
  @IsNotEmpty()
  catalogo_id: string;

  @IsMongoId()
  @IsNotEmpty()
  propiedad_id: string;

  @IsString()
  @IsOptional()
  numero_serie?: string;

  @IsDateString()
  @IsOptional()
  fecha_adquisicion?: string;

  @IsEnum(['NUEVO', 'ACTIVO', 'EN_REPARACION', 'DE_BAJA'])
  @IsNotEmpty()
  estado_actual: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HistorialEstadoDto)
  @IsOptional()
  historial_estados?: HistorialEstadoDto[];
}
