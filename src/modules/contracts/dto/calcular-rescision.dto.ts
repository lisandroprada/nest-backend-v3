import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CalcularRescisionDto {
  @IsDateString()
  @IsNotEmpty()
  fecha_notificacion_rescision: string;

  @IsDateString()
  @IsNotEmpty()
  fecha_recision_efectiva: string;

  @IsOptional()
  @IsString()
  motivo?: string;
}

export class RescisionResponseDto {
  aplica_penalidad: boolean;
  dias_preaviso: number;
  dias_hasta_final_contrato: number;
  meses_restantes: number;
  canon_futuro_total: number;
  porcentaje_penalidad: number;
  monto_penalidad: number;
  fecha_notificacion: Date;
  fecha_rescision: Date;
  exencion_por_plazo_extendido: boolean;
  mensaje: string;
}
