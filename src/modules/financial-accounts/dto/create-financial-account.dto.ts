import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber } from 'class-validator';

export class CreateFinancialAccountDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEnum(['BANCO', 'CAJA_CHICA'])
  @IsNotEmpty()
  tipo: string;

  @IsString()
  @IsOptional()
  moneda: string = 'ARS';

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsNumber()
  @IsOptional()
  saldo_inicial?: number;

  @IsEnum(['ACTIVA', 'INACTIVA'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  cbu?: string;

  @IsString()
  @IsOptional()
  alias?: string;

  @IsString()
  @IsOptional()
  nombre_banco?: string;
}