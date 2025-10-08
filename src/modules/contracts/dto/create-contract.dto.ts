import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AgenteRoles } from '../../agents/constants/agent-roles.enum';

class ParteDto {
  @IsMongoId()
  @IsNotEmpty()
  agente_id: string;

  @IsEnum(AgenteRoles)
  @IsNotEmpty()
  rol: AgenteRoles;
}

class TerminosFinancierosDto {
  @IsNumber()
  @IsNotEmpty()
  monto_base_vigente: number;

  @IsEnum(['ICL', 'IPC', 'FIJO'])
  @IsNotEmpty()
  indice_tipo: string;

  @IsNumber()
  @IsOptional()
  interes_mora_diaria?: number;
}

export class CreateContractDto {
  @IsMongoId()
  @IsNotEmpty()
  propiedad_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParteDto)
  partes: ParteDto[];

  @IsDateString()
  @IsNotEmpty()
  fecha_inicio: string;

  @IsDateString()
  @IsNotEmpty()
  fecha_final: string;

  @IsObject()
  @ValidateNested()
  @Type(() => TerminosFinancierosDto)
  terminos_financieros: TerminosFinancierosDto;

  @IsDateString()
  @IsNotEmpty()
  ajuste_programado: string;

  @IsNumber()
  @IsOptional()
  deposito_monto?: number;

  @IsEnum(['AL_ORIGEN', 'AL_ULTIMO_ALQUILER'])
  @IsOptional()
  deposito_tipo_ajuste?: string;
}
