import {
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TipoOperacion {
  COBRO = 'COBRO', // Actualiza partidas DEBE (cobrar al locatario)
  PAGO = 'PAGO', // Actualiza partidas HABER (pagar al locador/inmobiliaria)
}

class AsientoImputacionDto {
  @IsMongoId()
  @IsNotEmpty()
  asientoId: string;

  @IsNumber()
  @IsPositive()
  montoImputado: number;

  @IsOptional()
  @IsEnum(TipoOperacion)
  tipoOperacion?: TipoOperacion; // COBRO o PAGO - determina qué partidas se actualizan (opcional: se auto-detecta si no se provee)

  @IsOptional()
  @IsMongoId()
  agenteId?: string; // Requerido si tipoOperacion = PAGO (para liquidar solo a ese agente)
}

export enum TipoFlujoNeto {
  INGRESO = 'INGRESO',
  EGRESO = 'EGRESO',
}

export class CreateReceiptDto {
  @IsNumber()
  @IsPositive()
  monto_total_imputado: number; // Suma total de todos los montoImputado

  @IsNumber()
  @IsPositive()
  monto_recibido_fisico: number; // Monto físico recibido/pagado

  @IsEnum(TipoFlujoNeto)
  @IsNotEmpty()
  tipo_flujo_neto: TipoFlujoNeto; // INGRESO o EGRESO - resultado neto del comprobante

  @IsString()
  @IsNotEmpty()
  metodo_pago: string; // 'efectivo', 'transferencia', 'cheque', 'tarjeta'

  @IsOptional()
  @IsString()
  comprobante_externo?: string; // Número de transferencia/cheque

  @IsMongoId()
  @IsNotEmpty()
  cuenta_afectada_id: string; // Cuenta de caja/banco afectada

  @IsMongoId()
  @IsNotEmpty()
  agente_id: string; // Agente principal del recibo

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AsientoImputacionDto)
  asientos_a_imputar: AsientoImputacionDto[];

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsMongoId()
  contrato_id?: string;

  @IsOptional()
  @IsBoolean()
  emitir_factura?: boolean;
}
