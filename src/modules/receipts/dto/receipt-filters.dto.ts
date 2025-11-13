import { IsEnum, IsOptional, IsString } from 'class-validator';
// import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/pagination/dto/pagination.dto';

// Extiende del PaginationDto para homogeneizar la interfaz
export class ReceiptFiltersDto extends PaginationDto {
  @IsOptional()
  @IsEnum(['INGRESO', 'EGRESO'], { message: 'tipo_flujo_neto inválido' } as any)
  tipo_flujo_neto?: 'INGRESO' | 'EGRESO';

  @IsOptional()
  @IsString()
  fecha_from?: string; // ISO date string

  @IsOptional()
  @IsString()
  fecha_to?: string; // ISO date string

  // Usaremos page (0-based) y pageSize del PaginationDto.
  // Para mantener compatibilidad externa si pasan 'limit', lo mapearemos en el controller.

  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc' = 'desc';
}
