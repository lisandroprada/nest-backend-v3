import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryMessagesDto {
  @IsOptional()
  @IsEnum(['Email', 'WhatsApp', 'Formulario Web', 'Interno'])
  source?: 'Email' | 'WhatsApp' | 'Formulario Web' | 'Interno';

  @IsOptional()
  @IsEnum(['Nuevo', 'Leído', 'Archivado'])
  status?: 'Nuevo' | 'Leído' | 'Archivado';

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  search?: string; // Búsqueda en subject, content, sender

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
