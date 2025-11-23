import { IsMongoId, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class ProcessDetectedExpenseDto {
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  detectedExpenseId: string;

  @IsOptional()
  @IsMongoId()
  @IsString()
  mappingId?: string; // optional: if not provided, resolve by provider_agent_id
}
