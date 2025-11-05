import { IsDateString, IsOptional, IsMongoId, IsEnum } from 'class-validator';
import { PaginationDto } from '../../../common/pagination/dto/pagination.dto';

export class MovementsQueryDto extends PaginationDto {
  @IsOptional()
  @IsMongoId()
  cuenta_financiera_id?: string;

  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @IsOptional()
  @IsEnum(['INGRESO', 'EGRESO'])
  tipo?: 'INGRESO' | 'EGRESO';

  @IsOptional()
  @IsEnum(['true', 'false'])
  conciliado?: string; // Se recibe como string desde query params
}
