import {
  IsString,
  IsNotEmpty,
  IsMongoId,
  IsOptional,
  IsNumber,
  IsPositive,
  IsObject,
  IsArray,
} from 'class-validator';

export class CreateValuationDto {
  @IsMongoId()
  @IsOptional()
  propiedad_original_id?: string;

  @IsArray()
  @IsMongoId({ each: true })
  @IsNotEmpty()
  clientes_solicitantes_ids: string[];

  @IsMongoId()
  @IsNotEmpty()
  agente_tasador_id: string;

  @IsNumber()
  @IsPositive()
  honorario_facturar: number;

  @IsObject()
  @IsNotEmpty()
  datos_propiedad_snapshot: any;

  @IsObject()
  @IsOptional()
  parametros_valoracion?: any;

  @IsNumber()
  @IsPositive()
  valor_estimado_final: number;
}
