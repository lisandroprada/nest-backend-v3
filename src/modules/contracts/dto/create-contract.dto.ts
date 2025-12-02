import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { AgenteRoles } from '../../agents/constants/agent-roles.enum';
import { ServicioImpuesto } from '../../properties/entities/property.entity';

class ParteDto {
  @IsMongoId()
  @IsNotEmpty()
  agente_id: string;

  @IsEnum(AgenteRoles)
  @IsNotEmpty()
  rol: AgenteRoles;
}

class TerminosFinancierosDto {
  @IsNumber()
  @IsNotEmpty()
  monto_base_vigente: number;

  @IsEnum(['ICL', 'IPC', 'FIJO'])
  @IsNotEmpty()
  indice_tipo: string;

  @IsNumber()
  @IsOptional()
  interes_mora_diaria?: number;

  @IsEnum(['INCLUIDO', 'MAS_IVA'])
  @IsOptional()
  iva_calculo_base?: string;

  @IsNumber()
  @IsOptional()
  comision_administracion_porcentaje?: number;

  @IsNumber()
  @IsOptional()
  honorarios_locador_porcentaje?: number;

  @IsNumber()
  @IsOptional()
  honorarios_locatario_porcentaje?: number;

  @IsNumber()
  @IsOptional()
  ajuste_periodicidad_meses?: number;
}

export class CreateContractDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServicioImpuesto)
  servicios_impuestos_contrato?: ServicioImpuesto[];
  @IsOptional()
  @IsBoolean()
  firmas_completas?: boolean;

  @IsOptional()
  @IsBoolean()
  documentacion_completa?: boolean;

  @IsOptional()
  @IsBoolean()
  visita_realizada?: boolean;

  @IsOptional()
  @IsMongoId()
  inventory_version_id?: string;

  @IsEnum(['VIGENTE', 'FINALIZADO', 'RESCINDIDO', 'PENDIENTE'])
  @IsOptional()
  status?: string;
  @IsMongoId()
  @IsNotEmpty()
  propiedad_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParteDto)
  partes: ParteDto[];

  @IsDateString()
  @IsNotEmpty()
  fecha_inicio: string;

  @IsDateString()
  @IsNotEmpty()
  fecha_final: string;

  @IsEnum(['VIVIENDA_UNICA', 'VIVIENDA', 'COMERCIAL', 'TEMPORARIO', 'OTROS'])
  @IsOptional()
  tipo_contrato?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => TerminosFinancierosDto)
  terminos_financieros: TerminosFinancierosDto;

  @IsDateString()
  @IsNotEmpty()
  ajuste_programado: string;

  @IsNumber()
  @IsOptional()
  deposito_monto?: number;

  @IsEnum(['AL_ORIGEN', 'AL_ULTIMO_ALQUILER'])
  @IsOptional()
  deposito_tipo_ajuste?: string;

  @IsNumber()
  @IsOptional()
  duracion_meses?: number;
}
