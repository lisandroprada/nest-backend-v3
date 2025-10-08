import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsMongoId,
  IsBoolean,
} from 'class-validator';

export class CreateChartOfAccountDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEnum(['ACTIVO', 'PASIVO', 'PATRIMONIO_NETO', 'INGRESO', 'EGRESO'])
  @IsNotEmpty()
  tipo_cuenta: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsMongoId()
  @IsOptional()
  cuenta_padre_id?: string;

  @IsBoolean()
  @IsOptional()
  es_imputable?: boolean;
}
