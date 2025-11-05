import { IsDateString, IsMongoId, IsOptional, IsString } from 'class-validator';

export class LiquidarAsientoDto {
  @IsDateString()
  fecha_liquidacion: string; // Fecha de liquidación al propietario

  @IsString()
  metodo_liquidacion: string; // 'transferencia', 'cheque', 'efectivo', 'otro'

  @IsMongoId()
  cuenta_financiera_id: string; // ID de la cuenta financiera que realiza el pago

  @IsMongoId()
  agente_id: string; // ID del agente al que se liquida (propietario o inmobiliaria)

  @IsOptional()
  @IsString()
  comprobante?: string; // Número de comprobante de liquidación

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsString()
  usuario_id: string; // Usuario que realiza la liquidación
}
