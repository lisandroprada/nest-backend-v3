import { IsEnum, IsOptional, IsBoolean, IsDateString } from 'class-validator';
import { PaginationDto } from '../../../common/pagination/dto/pagination.dto';
import { TipoOperacion } from '../entities/bank-movement.entity';
import { Type } from 'class-transformer';

export class BankMovementQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(TipoOperacion)
  tipo_operacion?: TipoOperacion;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  conciliado_sistema?: boolean;

  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @IsOptional()
  identificador_fiscal?: string;

  @IsOptional()
  identificador_unico?: string;

  @IsOptional()
  nombre_tercero?: string;
}
