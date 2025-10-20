import { IsOptional, IsDateString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class EstadoCuentaFiltersDto {
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  incluir_pagados?: boolean = true;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  incluir_anulados?: boolean = false;
}
