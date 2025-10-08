import { IsArray, IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, ValidateNested, IsMongoId } from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';

class DocumentoDigitalDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  url: string;
}

export class CreatePropertyDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  propietarios_ids: string[];

  @IsString()
  @IsNotEmpty()
  identificador_interno: string;

  @IsString()
  @IsOptional()
  identificador_tributario?: string;

  @IsNumber()
  @IsOptional()
  valor_alquiler?: number;

  @IsEnum(['ORDINARIAS', 'EXTRAORDINARIAS', 'INCLUIDAS'])
  @IsOptional()
  tipo_expensas?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentoDigitalDto)
  @IsOptional()
  documentos_digitales?: DocumentoDigitalDto[];

  @IsEnum(['DISPONIBLE', 'ALQUILADO', 'RESERVADO', 'INACTIVO'])
  @IsOptional()
  status?: string;

  @IsMongoId()
  @IsOptional()
  contrato_vigente_id?: string;
}
