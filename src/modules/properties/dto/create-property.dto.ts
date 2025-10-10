import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  ValidateNested,
  IsMongoId,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

class DocumentoDigitalDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  url: string;
}

class ValorDetalladoDto {
  @IsNumber()
  @IsOptional()
  monto?: number;

  @IsString()
  @IsOptional()
  moneda?: string;

  @IsBoolean()
  @IsOptional()
  es_publico?: boolean;

  @IsString()
  @IsOptional()
  descripcion?: string;
}

class ImagenDto {
  @IsString()
  nombre: string;

  @IsString()
  url: string;

  @IsNumber()
  @IsOptional()
  orden?: number;

  @IsBoolean()
  @IsOptional()
  es_portada?: boolean;

  @IsObject()
  @IsOptional()
  versiones?: { thumb: string; slider: string; original: string };
}

class PlanoDto {
  @IsString()
  nombre: string;

  @IsString()
  url: string;

  @IsString()
  @IsOptional()
  descripcion?: string;
}

class ImagenSatelitalDto {
  @IsString()
  nombre: string;

  @IsString()
  url: string;

  @IsNumber()
  @IsOptional()
  ancho?: number;

  @IsNumber()
  @IsOptional()
  alto?: number;

  @IsNumber()
  @IsOptional()
  pixels_por_metro?: number;
}

class LoteDto {
  @IsString()
  id: string;

  @IsArray()
  coordenadas: { x: number; y: number }[];

  @IsString()
  status: string;

  @IsNumber()
  @IsOptional()
  precio?: number;

  @IsString()
  @IsOptional()
  moneda?: string;

  @IsNumber()
  @IsOptional()
  superficie_m2?: number;
}

class CaracteristicasDto {
  @IsString()
  @IsOptional()
  @IsEnum([
    'departamento',
    'casa',
    'ph',
    'oficina',
    'local_comercial',
    'galpon',
    'lote',
    'quinta',
    'chacra',
    'estudio',
    'loft',
    'duplex',
    'triplex',
  ])
  tipo_propiedad?: string;

  @IsNumber()
  @IsOptional()
  dormitorios?: number;

  @IsNumber()
  @IsOptional()
  banos?: number;

  @IsNumber()
  @IsOptional()
  ambientes?: number;

  @IsNumber()
  @IsOptional()
  metraje_total?: number;

  @IsNumber()
  @IsOptional()
  metraje_cubierto?: number;

  @IsNumber()
  @IsOptional()
  antiguedad_anos?: number;

  @IsNumber()
  @IsOptional()
  cochera?: number;

  @IsString()
  @IsOptional()
  @IsEnum([
    'EXCELENTE',
    'MUY_BUENO',
    'BUENO',
    'REGULAR',
    'MALO',
    'A_REFACCIONAR',
  ])
  estado_general?: string;

  @IsString()
  @IsOptional()
  @IsEnum([
    'NORTE',
    'SUR',
    'ESTE',
    'OESTE',
    'NORESTE',
    'NOROESTE',
    'SURESTE',
    'SUROESTE',
  ])
  orientacion?: string;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  amenities?: string[];
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

  // Caracteristicas de la propiedad
  @ValidateNested()
  @Type(() => CaracteristicasDto)
  @IsOptional()
  caracteristicas?: CaracteristicasDto;

  @IsNumber()
  @IsOptional()
  valor_alquiler?: number;

  // Nuevos campos de valor detallado
  @ValidateNested()
  @Type(() => ValorDetalladoDto)
  @IsOptional()
  valor_venta_detallado?: ValorDetalladoDto;

  @ValidateNested()
  @Type(() => ValorDetalladoDto)
  @IsOptional()
  valor_alquiler_detallado?: ValorDetalladoDto;

  // Flags de publicación
  @IsBoolean()
  @IsOptional()
  publicar_para_venta?: boolean;

  @IsBoolean()
  @IsOptional()
  publicar_para_alquiler?: boolean;

  @IsEnum(['ORDINARIAS', 'EXTRAORDINARIAS', 'INCLUIDAS'])
  @IsOptional()
  tipo_expensas?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentoDigitalDto)
  @IsOptional()
  documentos_digitales?: DocumentoDigitalDto[];

  // Nuevos campos multimedia
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImagenDto)
  @IsOptional()
  imagenes?: ImagenDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanoDto)
  @IsOptional()
  planos?: PlanoDto[];

  // Campos de imagen satelital y lotes
  @ValidateNested()
  @Type(() => ImagenSatelitalDto)
  @IsOptional()
  imagen_satelital?: ImagenSatelitalDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LoteDto)
  @IsOptional()
  lotes?: LoteDto[];

  @IsEnum(['DISPONIBLE', 'ALQUILADO', 'RESERVADO', 'INACTIVO'])
  @IsOptional()
  status?: string;

  @IsMongoId()
  @IsOptional()
  contrato_vigente_id?: string;
}
