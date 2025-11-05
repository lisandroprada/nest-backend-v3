import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';

/**
 * Tipos de operación en un recibo
 */
export enum TipoOperacionRecibo {
  COBRO = 'COBRO', // DEBE - Cobrar al locatario
  PAGO = 'PAGO', // HABER - Pagar al locador/inmobiliaria
}

/**
 * Representa una línea/operación individual en el recibo
 */
export class LineaReciboDto {
  @IsNotEmpty()
  @IsMongoId()
  asiento_id: string; // ID del asiento contable

  @IsNotEmpty()
  @IsEnum(TipoOperacionRecibo)
  tipo_operacion: TipoOperacionRecibo; // COBRO o PAGO

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  monto: number; // Monto de esta operación

  @IsOptional()
  @IsMongoId()
  agente_id?: string; // Requerido si tipo_operacion = PAGO (para saber a quién liquidar)

  @IsOptional()
  @IsString()
  concepto?: string; // Descripción del concepto
}

/**
 * DTO para procesar un recibo completo con múltiples operaciones
 */
export class ProcessReceiptDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineaReciboDto)
  lineas: LineaReciboDto[]; // Array de operaciones (cobros y pagos)

  @IsNotEmpty()
  @IsMongoId()
  cuenta_financiera_id: string; // Cuenta de caja

  @IsNotEmpty()
  @IsDateString()
  fecha: string; // Fecha del recibo

  @IsNotEmpty()
  @IsString()
  metodo: string; // transferencia, efectivo, cheque

  @IsNotEmpty()
  @IsMongoId()
  usuario_id: string; // Usuario que registra

  @IsOptional()
  @IsString()
  comprobante?: string; // Número de comprobante

  @IsOptional()
  @IsString()
  observaciones?: string; // Observaciones generales del recibo
}
