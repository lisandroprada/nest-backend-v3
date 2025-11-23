import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class UpdateServiceAccountMappingDto {
  // snake_case fields
  @IsString()
  @IsOptional()
  provider_cuit?: string;

  @IsString()
  @IsOptional()
  identificador_servicio?: string;

  // camelCase aliases from frontend
  @IsString()
  @IsOptional()
  providerCuit?: string;

  @IsString()
  @IsOptional()
  identificadorServicio?: string;

  @IsString()
  @IsOptional()
  cuenta_egreso_codigo?: string;

  @IsString()
  @IsOptional()
  cuenta_a_pagar_codigo?: string;

  @IsString()
  @IsOptional()
  moneda?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsNumber()
  @IsOptional()
  prioridad?: number;
}
