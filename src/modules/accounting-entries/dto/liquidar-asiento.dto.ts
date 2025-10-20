import { IsDateString, IsOptional, IsString } from 'class-validator';

export class LiquidarAsientoDto {
  @IsDateString()
  fecha_liquidacion: string; // Fecha de liquidación al propietario

  @IsString()
  metodo_liquidacion: string; // 'transferencia', 'cheque', 'efectivo', 'otro'

  @IsOptional()
  @IsString()
  comprobante?: string; // Número de comprobante de liquidación

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsString()
  usuario_id: string; // Usuario que realiza la liquidación
}
