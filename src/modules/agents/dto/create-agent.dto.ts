import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsObject,
  IsOptional,
  ValidateNested,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AgenteRoles } from '../constants/agent-roles.enum';

class CuentaBancariaDto {
  @IsString()
  @IsOptional()
  cbu_alias: string;

  @IsString()
  @IsNotEmpty()
  cbu_numero: string;

  @IsString()
  @IsNotEmpty()
  banco: string;

  @IsString()
  @IsNotEmpty()
  moneda: string;
}

export class CreateAgentDto {
  @IsArray()
  @IsEnum(AgenteRoles, { each: true })
  @IsNotEmpty()
  rol: AgenteRoles[];

  @IsEnum(['FISICA', 'JURIDICA'])
  @IsNotEmpty()
  persona_tipo: string;

  @IsEnum(['CF', 'RI', 'MONOTRIBUTO'])
  @IsNotEmpty()
  nomenclador_fiscal: string;

  @IsString()
  @IsNotEmpty()
  identificador_fiscal: string;

  @IsString()
  @IsNotEmpty()
  nombre_razon_social: string;

  @IsString()
  @IsOptional()
  nombres: string;

  @IsString()
  @IsOptional()
  apellidos: string;

  @IsEnum(['MASCULINO', 'FEMENINO', 'PERSONA_JURIDICA'])
  @IsOptional()
  genero: string;

  @IsEnum(['DNI', 'LE', 'LC', 'PASAPORTE'])
  @IsOptional()
  documento_tipo: string;

  @IsString()
  @IsOptional()
  documento_numero: string;

  @IsBoolean()
  @IsOptional()
  cuit_validado?: boolean;

  @IsDateString()
  @IsOptional()
  cuit_validado_en?: string;

  @IsObject()
  @IsOptional()
  direccion_legal?: object;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CuentaBancariaDto)
  @IsOptional()
  cuentas_bancarias?: CuentaBancariaDto[];

  @IsString()
  @IsOptional()
  password?: string;

  @IsEnum(['ACTIVO', 'INACTIVO'])
  @IsOptional()
  status?: string;
}
