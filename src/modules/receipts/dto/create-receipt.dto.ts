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

export class CreateReceiptDto {
  @IsNumber()
  @IsPositive()
  monto_total: number;

  @IsString()
  @IsNotEmpty()
  metodo_pago: string; // 'efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro'

  @IsOptional()
  @IsString()
  comprobante_externo?: string; // Referencia externa, ej. número de transferencia

  @IsMongoId()
  @IsNotEmpty()
  cuenta_financiera_id: string;

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
