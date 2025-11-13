import { IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class DepositosPendientesFilterDto {
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @IsOptional()
  @IsBoolean()
  solo_proximos_a_vencer?: boolean; // Filtrar contratos que finalizan en los próximos 30 días
}

export class DepositoPendienteResponseDto {
  contrato_id: string;
  numero_contrato: string;
  fecha_inicio: Date;
  fecha_final: Date;
  dias_hasta_finalizacion: number;

  locador: {
    agente_id: string;
    nombre: string;
  };

  locatario: {
    agente_id: string;
    nombre: string;
  };

  propiedad: {
    direccion: string;
  };

  deposito: {
    monto_original: number;
    monto_a_devolver: number;
    tipo_ajuste: string; // 'AL_ORIGEN' | 'AL_ULTIMO_ALQUILER'
    ultimo_monto_alquiler?: number;
    asiento_id: string;
    estado_liquidacion: 'PENDIENTE' | 'LIQUIDADO_PARCIAL' | 'LIQUIDADO';
    monto_liquidado: number;
    saldo_pendiente: number;
  };
}
