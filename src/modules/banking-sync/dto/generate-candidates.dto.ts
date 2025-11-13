import { IsOptional, IsNumber, Min, Max } from 'class-validator';

export class GenerateCandidatesDto {
  @IsOptional()
  bankMovementId?: string; // Si se especifica, genera solo para ese movimiento

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(3)
  fechaToleranceDays?: number = 1; // Tolerancia en días para fecha

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  maxCandidatesPerMovement?: number = 5; // Límite superior de candidatos por movimiento
}
