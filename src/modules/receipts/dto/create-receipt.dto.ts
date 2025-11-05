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
} from 'class-validator';
import { Type } from 'class-transformer';

class AsientoImputacionDto {
  @IsMongoId()
  @IsNotEmpty()
  asientoId: string;

  @IsNumber()
  @IsPositive()
  montoImputado: number;
}

import { IsEnum } from 'class-validator';

export enum TipoFlujoNeto {
  INGRESO = 'INGRESO',
  EGRESO = 'EGRESO',
}

export class CreateReceiptDto {
  @IsNumber()
  @IsPositive()
  monto_total_imputado: number; // Nuevo nombre: El monto total del array de imputaciones.

  @IsNumber()
  @IsPositive()
  monto_recibido_fisico: number; // CRÍTICO: El operador ingresa el efectivo/transferencia.

  @IsEnum(TipoFlujoNeto)
  @IsNotEmpty()
  tipo_flujo_neto: TipoFlujoNeto; // NUEVO: Resultado de la compensación: 'INGRESO' o 'EGRESO'.

  @IsString()
  @IsNotEmpty()
  metodo_pago: string; // 'efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro'

  @IsOptional()
  @IsString()
  comprobante_externo?: string; // CRÍTICO: ID de la transferencia/cheque. Debe ser obligatorio para Conciliación.

  @IsMongoId()
  @IsNotEmpty()
  cuenta_afectada_id: string; // Renombrado: La cuenta de la Inmobiliaria (origen si es Egreso, destino si es Ingreso).

  @IsMongoId()
  @IsNotEmpty()
  agente_id: string; // Agente que realiza el pago

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AsientoImputacionDto)
  asientos_a_imputar: AsientoImputacionDto[];

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsMongoId()
  contrato_id?: string; // Opcional: vincular a un contrato

  @IsOptional()
  @IsBoolean()
  emitir_factura?: boolean; // Opcional: si se debe emitir una factura fiscal
}
