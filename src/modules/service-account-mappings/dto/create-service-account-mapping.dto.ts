import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsMongoId,
  IsNotEmpty,
} from 'class-validator';

export class CreateServiceAccountMappingDto {
  @IsMongoId()
  @IsNotEmpty()
  provider_agent_id: string;

  // snake_case used in DB
  @IsString()
  @IsOptional()
  provider_cuit?: string;

  @IsString()
  @IsOptional()
  provider_name?: string;

  @IsString()
  @IsOptional()
  identificador_servicio?: string;

  // camelCase aliases accepted from frontend (ValidationPipe will include them)
  @IsString()
  @IsOptional()
  providerCuit?: string;

  @IsString()
  @IsOptional()
  identificadorServicio?: string;

  @IsString()
  @IsNotEmpty()
  cuenta_egreso_codigo: string;

  @IsString()
  @IsNotEmpty()
  cuenta_a_pagar_codigo: string;

  @IsString()
  @IsOptional()
  moneda?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsNumber()
  @IsOptional()
  prioridad?: number;

  @IsString()
  @IsOptional()
  created_by?: string;
}
