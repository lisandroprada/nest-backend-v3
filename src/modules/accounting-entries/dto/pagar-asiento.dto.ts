import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class PagarAsientoDto {
  @IsDateString()
  fecha_pago: string; // Fecha real del pago

  @IsNumber()
  @Min(0)
  monto_pagado: number; // Monto total pagado

  @IsOptional()
  @IsString()
  metodo_pago?: string; // 'efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro'

  @IsOptional()
  @IsString()
  comprobante?: string; // Número de comprobante/recibo

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsString()
  usuario_id: string; // Usuario que registra el pago
}
