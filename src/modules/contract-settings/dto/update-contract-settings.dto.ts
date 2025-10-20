import {
  IsNumber,
  IsBoolean,
  IsEnum,
  IsArray,
  ValidateNested,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class TipoContratoConfigDto {
  @IsEnum(['VIVIENDA_UNICA', 'VIVIENDA', 'COMERCIAL', 'TEMPORARIO', 'OTROS'])
  tipo_contrato: string;

  @IsNumber()
  @Min(1)
  @Max(120)
  duracion_meses_default: number;

  @IsEnum(['ICL', 'IPC', 'FIJO'])
  indice_tipo_default: string;

  @IsNumber()
  @Min(1)
  @Max(12)
  ajuste_periodicidad_meses_default: number;

  @IsBoolean()
  permite_renovacion_automatica: boolean;

  @IsOptional()
  @IsString()
  descripcion?: string;

  // Overrides de honorarios por tipo de contrato (opcionales)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  honorarios_locador_porcentaje_default?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  honorarios_locatario_porcentaje_default?: number;
}

export class UpdateContractSettingsDto {
  // Configuración Financiera
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  interes_mora_diaria_default?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(30)
  dias_mora_default?: number;

  @IsOptional()
  @IsEnum(['INCLUIDO', 'MAS_IVA'])
  iva_calculo_base_default?: string;

  // Honorarios
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  comision_administracion_default?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  honorarios_locador_porcentaje_default?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  honorarios_locador_cuotas_default?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  honorarios_locatario_porcentaje_default?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  honorarios_locatario_cuotas_default?: number;

  // Tipos de Contrato
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TipoContratoConfigDto)
  tipos_contrato?: TipoContratoConfigDto[];

  // Depósitos
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  deposito_cuotas_default?: number;

  @IsOptional()
  @IsEnum(['AL_ORIGEN', 'AL_ULTIMO_ALQUILER'])
  deposito_tipo_ajuste_default?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(6)
  deposito_meses_alquiler?: number;

  // Ajustes
  @IsOptional()
  @IsBoolean()
  ajuste_es_fijo_default?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ajuste_porcentaje_default?: number;

  // Notificaciones
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(180)
  dias_aviso_vencimiento?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(180)
  dias_aviso_ajuste?: number;

  @IsOptional()
  @IsBoolean()
  enviar_recordatorio_pago?: boolean;

  // Rescisión Anticipada
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(90)
  rescision_dias_preaviso_minimo?: number;

  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(180)
  rescision_dias_sin_penalidad?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  rescision_porcentaje_penalidad?: number;
}
