import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray, IsMongoId } from 'class-validator';
import { TicketCategory, TicketUrgency } from '../schemas/ticket.schema';

export class CreateTicketDto {
  @IsMongoId()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsOptional()
  propertyId?: string;

  @IsEnum(TicketCategory)
  @IsNotEmpty()
  category: TicketCategory;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(TicketUrgency)
  @IsNotEmpty()
  urgency: TicketUrgency;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  evidenceUrls?: string[];

  @IsString()
  @IsOptional()
  whatsappJid?: string;
}
