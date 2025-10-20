import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export enum TipoMotivoCondonacion {
  ACUERDO_COMERCIAL = 'ACUERDO_COMERCIAL',
  CASO_SOCIAL = 'CASO_SOCIAL',
  ERROR_SISTEMA = 'ERROR_SISTEMA',
  OTRO = 'OTRO',
}

export class CondonarAsientoDto {
  @IsString()
  @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres' })
  motivo: string; // Motivo detallado de la condonación

  @IsEnum(TipoMotivoCondonacion)
  tipo_motivo: TipoMotivoCondonacion; // Tipo de motivo

  @IsOptional()
  @IsNumber()
  @Min(0)
  monto_condonado?: number; // Si es null, condona el total

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsString()
  usuario_id: string; // Usuario que solicita la condonación

  @IsString()
  usuario_autorizador_id: string; // Usuario autorizador (debe tener rol admin/superUser)
}
