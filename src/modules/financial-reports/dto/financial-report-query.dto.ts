import { IsOptional, IsDateString } from 'class-validator';

export class FinancialReportQueryDto {
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;
}
