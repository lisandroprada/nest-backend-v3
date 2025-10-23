import {
  IsString,
  IsNotEmpty,
  IsMongoId,
  IsNumber,
  IsPositive,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreateTransactionDto {
  @IsMongoId()
  @IsNotEmpty()
  referencia_asiento: string;

  @IsNumber()
  @IsPositive()
  monto: number;

  @IsMongoId()
  @IsNotEmpty()
  cuenta_financiera_id: string;

  @IsDateString()
  @IsOptional()
  fecha_transaccion?: string;

  @IsEnum(['INGRESO', 'EGRESO'])
  @IsNotEmpty()
  tipo: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsString()
  @IsOptional()
  referencia_bancaria?: string;

  @IsMongoId()
  @IsOptional()
  receipt_id?: string;
}
