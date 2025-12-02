import {IsString, IsArray, IsOptional, IsBoolean, IsObject} from 'class-validator';

export class CreateBrandCatalogDto {
  @IsString()
  categoria: string;

  @IsString()
  @IsOptional()
  subcategoria?: string;

  @IsArray()
  @IsString({each: true})
  marcas: string[];

  @IsArray()
  @IsString({each: true})
  @IsOptional()
  items_comunes?: string[];

  @IsOptional()
  modelos?: Map<string, string[]>;

  @IsArray()
  @IsString({each: true})
  @IsOptional()
  keywords?: string[];

  @IsObject()
  @IsOptional()
  metadata?: {
    pais?: string;
    popularidad?: number;
    descripcion?: string;
    uso_frecuencia?: Map<string, number>;
  };

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
