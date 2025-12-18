import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class SenderDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  avatar?: string;
}

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ValidateNested()
  @Type(() => SenderDto)
  sender: SenderDto;

  @IsEnum(['Email', 'WhatsApp', 'Formulario Web', 'Interno'])
  source: 'Email' | 'WhatsApp' | 'Formulario Web' | 'Interno';

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  contentPlainText?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

// DTO para formularios web (simplificado)
export class CreateFormMessageDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  propertyId?: string;
}
