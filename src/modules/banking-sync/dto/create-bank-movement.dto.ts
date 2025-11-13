import {
  IsString,
  IsNumber,
  IsEnum,
  IsDate,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoOperacion } from '../entities/bank-movement.entity';

export class CreateBankMovementDto {
  @IsString()
  identificador_unico: string;

  @IsEnum(TipoOperacion)
  tipo_operacion: TipoOperacion;

  @IsNumber()
  monto: number;

  @IsDate()
  @Type(() => Date)
  fecha_operacion: Date;

  @IsOptional()
  @IsString()
  cuenta_origen_cbu?: string;

  @IsOptional()
  @IsString()
  cuenta_destino_cbu?: string;

  @IsOptional()
  @IsString()
  identificador_fiscal?: string;

  @IsOptional()
  @IsString()
  nombre_tercero?: string;

  @IsOptional()
  @IsString()
  concepto_transaccion?: string;

  @IsString()
  email_id: string;

  @IsOptional()
  @IsBoolean()
  conciliado_sistema?: boolean;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  email_asunto?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  email_fecha?: Date;
}
