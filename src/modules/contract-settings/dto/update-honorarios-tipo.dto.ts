import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateHonorariosTipoDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  honorarios_locador_porcentaje_default?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  honorarios_locatario_porcentaje_default?: number;
}
