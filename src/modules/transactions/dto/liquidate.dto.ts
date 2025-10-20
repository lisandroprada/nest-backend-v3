import {
  IsArray,
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsPositive,
} from 'class-validator';

export class LiquidateDto {
  @IsMongoId()
  @IsNotEmpty()
  locador_id: string;

  @IsMongoId()
  @IsNotEmpty()
  cuenta_financiera_id: string;

  @IsArray()
  @IsMongoId({ each: true })
  @IsNotEmpty()
  asientos_a_liquidar: string[];

  @IsNumber()
  @IsPositive()
  monto_total: number;

  @IsDateString()
  @IsNotEmpty()
  fecha_pago: string;
}
