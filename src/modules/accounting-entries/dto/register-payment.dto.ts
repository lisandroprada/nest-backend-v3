import {
  IsDateString,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class RegisterPaymentDto {
  @IsDateString()
  fecha_pago: string; // Fecha real del pago

  @IsNumber()
  @Min(0)
  monto_pagado: number; // Monto que se está pagando en esta transacción

  @IsOptional()
  @IsString()
  metodo_pago?: string; // 'efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro'

  @IsMongoId()
  cuenta_financiera_id: string; // ID de la cuenta financiera que recibe/paga

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsString()
  usuario_id: string; // Usuario que registra el pago
}
