import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Types } from 'mongoose';

class PartidaDto {
  @IsMongoId()
  @IsNotEmpty()
  cuenta_id: Types.ObjectId;

  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsNumber()
  @IsOptional()
  debe?: number;

  @IsNumber()
  @IsOptional()
  haber?: number;

  @IsMongoId()
  @IsOptional()
  agente_id?: Types.ObjectId;
}

export class CreateAccountingEntryDto {
  @IsMongoId()
  @IsOptional() // Un asiento puede no estar ligado a un contrato (ej. asiento de apertura)
  contrato_id?: Types.ObjectId;

  @IsDateString()
  @IsNotEmpty()
  fecha_imputacion: string;

  @IsDateString()
  @IsNotEmpty()
  fecha_vencimiento: string;

  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsString()
  @IsNotEmpty()
  tipo_asiento: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartidaDto)
  partidas: PartidaDto[];

  @IsMongoId()
  @IsOptional()
  usuario_creacion_id?: Types.ObjectId;

  @IsMongoId()
  @IsOptional()
  usuario_modificacion_id?: Types.ObjectId;
}
