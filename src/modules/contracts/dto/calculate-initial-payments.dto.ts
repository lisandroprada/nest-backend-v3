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
} from 'class-validator';
import { AgenteRoles } from '../../agents/constants/agent-roles.enum';

/**
 * DTO para solicitar el cálculo de asientos iniciales sin persistir
 */
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
  honorarios_locador_cuotas?: number;

  @IsNumber()
  @IsOptional()
  honorarios_locatario_porcentaje?: number;

  @IsNumber()
  @IsOptional()
  honorarios_locatario_cuotas?: number;
}

export class CalculateInitialPaymentsDto {
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
  deposito_cuotas?: number;
}

/**
 * Representa una partida contable dentro de un asiento
 */
export class PartidaPreviewDto {
  cuenta_codigo: string; // Ej: "CXC_ALQ", "ING_HNR"
  cuenta_nombre: string; // Ej: "Cuentas por Cobrar - Alquileres"
  descripcion: string;
  debe: number;
  haber: number;
  agente_id?: string; // ObjectId del agente
  agente_nombre?: string; // Nombre del agente (opcional para frontend)
}

/**
 * Representa un asiento contable sin persistir
 */
export class AsientoPreviewDto {
  tipo_asiento: string; // Ej: "Alquiler", "Deposito en Garantia", "Honorarios Locador"
  fecha_vencimiento: string; // ISO string
  descripcion: string;
  partidas: PartidaPreviewDto[];
  total_debe: number;
  total_haber: number;
  // Agentes a los que se imputa este asiento (por rol)
  imputaciones?: Array<{
    rol: AgenteRoles;
    agente_id: string;
  }>;
}

/**
 * Respuesta con todos los asientos iniciales calculados
 */
export class CalculateInitialPaymentsResponseDto {
  asientos_alquiler: AsientoPreviewDto[];
  asiento_deposito?: AsientoPreviewDto;
  asientos_honorarios_locador: AsientoPreviewDto[];
  asientos_honorarios_locatario: AsientoPreviewDto[];

  // Base de cálculo de IVA utilizada para este contrato (INCLUIDO o MAS_IVA)
  iva_calculo_base: string;

  // Desglose de honorarios de la inmobiliaria
  honorarios_inmobiliaria: {
    mensual: {
      porcentaje: number; // porcentaje sobre alquiler mensual
      monto_mensual: number;
      meses_proyectados: number;
      total: number;
    };
    locador: {
      porcentaje: number;
      cuotas: number;
      monto_total: number;
      monto_por_cuota: number;
    };
    locatario: {
      porcentaje: number;
      cuotas: number;
      monto_total: number;
      monto_por_cuota: number;
    };
    notas_iva?: string; // descripción útil para frontend
  };

  resumen: {
    total_asientos: number;
    total_meses_alquiler: number;
    monto_total_alquileres: number;
    monto_deposito: number;
    monto_total_honorarios_locador: number;
    monto_total_honorarios_locatario: number;
    monto_total_honorarios_inmobiliaria: number;
  };
  pagos_iniciales: Array<{
    agente_id: string;
    rol: 'LOCADOR' | 'LOCATARIO' | 'INMOBILIARIA';
    movimientos: Array<{
      tipo: string; // 'Alquiler' | 'Honorarios' | 'Depósito' | 'Administración'
      cuenta: string; // código de cuenta contable
      debe: number;
      haber: number;
      descripcion: string;
    }>;
  }>;
  totalizadores_por_agente: Array<{
    agente_id: string;
    rol: 'LOCADOR' | 'LOCATARIO' | 'INMOBILIARIA';
    total_debe: number;
    total_haber: number;
  }>;
}
