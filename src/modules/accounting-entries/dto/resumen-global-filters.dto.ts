import { IsOptional, IsDateString } from 'class-validator';

export class ResumenGlobalFiltersDto {
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;
}
