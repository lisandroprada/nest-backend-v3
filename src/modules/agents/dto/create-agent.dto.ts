import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsObject,
  IsOptional,
  ValidateNested,
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
