import {
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsString,
  IsArray,
  IsBoolean,
} from 'class-validator';

export class GenerateServiceCandidatesDto {
  @IsOptional()
  @IsString()
  communicationId?: string; // Genera solo para esta comunicación (alias)

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  communicationIds?: string[]; // Genera para un conjunto de comunicaciones (batch)

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  maxPerRun?: number = 50; // Límite superior por corrida

  @IsOptional()
  @IsString()
  providerCuit?: string; // Filtrar por proveedor si se desea

  @IsOptional()
  @IsBoolean()
  tryExtractServiceId?: boolean = true; // Intentar extraer identificador si falta
}
