import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class PagoParcialDto {
  @IsDateString()
  fecha_pago: string; // Fecha del pago parcial

  @IsNumber()
  @Min(0)
  monto_pagado: number; // Monto parcial pagado

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
