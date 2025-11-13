import {
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AccountingEntryFiltersDto {
  @IsOptional()
  @IsMongoId()
  contrato_id?: string;

  @IsOptional()
  @IsMongoId()
  agente_id?: string;

  @IsOptional()
  @IsString()
  tipo_asiento?: string;

  @IsOptional()
  @IsEnum([
    'PENDIENTE',
    'PAGADO',
    'PAGADO_PARCIAL',
    'COBRADO', // DEBE cobrado pero HABER pendiente de liquidación
    'ANULADO',
    'CONDONADO',
    'PENDIENTE_APROBACION',
    'LIQUIDADO',
    'ANULADO_POR_RESCISION',
    'PENDIENTE_FACTURAR',
    'FACTURADO',
  ])
  estado?: string;

  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  solo_pendientes?: boolean;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sort?: string = '-fecha_imputacion';
}
