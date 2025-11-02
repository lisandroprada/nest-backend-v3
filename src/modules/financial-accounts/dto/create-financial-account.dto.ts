import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsMongoId,
} from 'class-validator';

export class CreateFinancialAccountDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEnum([
    'BANCO_CTA_CTE',
    'BANCO_CAJA_AHORRO',
    'CAJA_EFECTIVO',
    'VALORES_A_DEPOSITAR',
    'CUENTAS_POR_COBRAR',
  ])
  @IsNotEmpty()
  tipo: string;

  @IsEnum(['ARS', 'USD', 'EUR'])
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

  @IsMongoId()
  @IsOptional()
  bank_id?: string; // Reference to the Bank entity
}
