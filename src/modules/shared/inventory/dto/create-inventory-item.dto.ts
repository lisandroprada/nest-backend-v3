import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  categoria: string;

  @IsString()
  @IsNotEmpty()
  descripcion_base: string;

  @IsString()
  @IsOptional()
  marca?: string;

  @IsString()
  @IsOptional()
  modelo?: string;

  @IsString({ each: true })
  @IsOptional()
  fotos_urls?: string[];
}
