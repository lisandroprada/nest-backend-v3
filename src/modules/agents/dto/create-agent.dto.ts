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
  IsMongoId,
  ArrayMinSize,
  IsNumber,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AgenteRoles } from '../constants/agent-roles.enum';

class TelefonoDto {
  @IsString()
  @IsNotEmpty()
  numero: string;

  @IsEnum(['MOVIL', 'FIJO'])
  @IsNotEmpty()
  tipo: string;
}

class DireccionDto {
  @IsString()
  @IsOptional()
  calle?: string;

  @IsString()
  @IsOptional()
  numero?: string;

  @IsString()
  @IsOptional()
  piso_dpto?: string;

  @IsMongoId()
  @IsOptional()
  provincia_id?: string;

  @IsMongoId()
  @IsOptional()
  localidad_id?: string;

  @IsString()
  @IsOptional()
  codigo_postal?: string;

  @IsNumber()
  @IsOptional()
  latitud?: number;

  @IsNumber()
  @IsOptional()
  longitud?: number;
}

class CuentaBancariaDto {
  @IsString()
  @IsOptional()
  cbu_alias: string;

  @IsString()
  @IsNotEmpty()
  cbu_numero: string;

  @IsMongoId()
  @IsNotEmpty()
  bank_id: string; // Reference to the Bank entity

  @IsString()
  @IsNotEmpty()
  moneda: string;

  @IsString()
  @IsNotEmpty()
  cbu_tipo: string;
}

export class CreateAgentDto {
  @IsArray()
  @ArrayMinSize(0)
  @IsEnum(AgenteRoles, { each: true })
  @IsOptional()
  rol?: AgenteRoles[];

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
  nombres?: string;

  @IsString()
  @IsOptional()
  apellidos?: string;

  @IsEnum(['MASCULINO', 'FEMENINO', 'PERSONA_JURIDICA'])
  @IsOptional()
  genero?: string;

  @IsEnum(['DNI', 'LE', 'LC', 'PASAPORTE'])
  @IsOptional()
  documento_tipo?: string;

  @IsString()
  @IsOptional()
  documento_numero?: string;

  @IsBoolean()
  @IsOptional()
  cuit_validado?: boolean;

  @IsDateString()
  @IsOptional()
  cuit_validado_en?: string;

  @IsEmail()
  @IsOptional()
  email_principal?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TelefonoDto)
  @IsOptional()
  telefonos?: TelefonoDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => DireccionDto)
  @IsOptional()
  direccion_fiscal?: DireccionDto;

  @IsObject()
  @ValidateNested()
  @Type(() => DireccionDto)
  @IsOptional()
  direccion_real?: DireccionDto;

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
