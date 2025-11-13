import { IsString, IsEnum, IsOptional } from 'class-validator';
import { CandidateStatus } from '../entities/conciliation-candidate.entity';

export class UpdateCandidateStatusDto {
  @IsString()
  candidateId: string;

  @IsEnum(CandidateStatus)
  status: CandidateStatus; // CONFIRMED o REJECTED

  @IsOptional()
  @IsString()
  notes?: string;
}
