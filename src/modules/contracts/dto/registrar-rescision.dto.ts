import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class RegistrarRescisionDto {
  @IsDateString()
  @IsNotEmpty()
  fecha_notificacion_rescision: string;

  @IsDateString()
  @IsNotEmpty()
  fecha_recision_anticipada: string;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  penalidad_monto: number;

  @IsOptional()
  @IsString()
  motivo?: string;
}
