import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum TipoMotivoAnulacion {
  ERROR_CARGA = 'ERROR_CARGA',
  DUPLICADO = 'DUPLICADO',
  CONTRATO_CANCELADO = 'CONTRATO_CANCELADO',
  RESCISION_CONTRATO = 'RESCISION_CONTRATO',
  OTRO = 'OTRO',
}

export class AnularAsientoDto {
  @IsString()
  @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres' })
  motivo: string; // Motivo detallado de la anulación

  @IsEnum(TipoMotivoAnulacion)
  tipo_motivo: TipoMotivoAnulacion; // Tipo de motivo

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsString()
  usuario_id: string; // Usuario que anula el asiento
}
