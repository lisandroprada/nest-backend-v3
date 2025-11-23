import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CommunicationStatus } from '../entities/service-communication.entity';

export class UpdateCommunicationStatusDto {
  @IsString()
  communicationId: string;

  @IsEnum(CommunicationStatus)
  status: CommunicationStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
