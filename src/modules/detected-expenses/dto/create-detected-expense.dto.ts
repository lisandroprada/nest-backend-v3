import {
  IsString,
  IsNotEmpty,
  IsMongoId,
  IsOptional,
  IsNumber,
  IsEnum,
} from 'class-validator';

export class CreateDetectedExpenseDto {
  @IsMongoId()
  @IsNotEmpty()
  agente_proveedor_id: string;

  @IsEnum(['FACTURA_DISPONIBLE', 'AVISO_DEUDA', 'AVISO_CORTE'])
  @IsNotEmpty()
  tipo_alerta: string;

  @IsString()
  @IsNotEmpty()
  identificador_servicio: string;

  @IsNumber()
  @IsOptional()
  monto_estimado?: number;

  @IsEnum(['PENDIENTE_VALIDACION', 'ASIGNADO', 'DESCARTADO'])
  @IsOptional()
  estado_procesamiento?: string;

  @IsString()
  @IsOptional()
  cuerpo_email?: string;

  @IsString()
  @IsOptional()
  adjunto_referencia_url?: string;
}
