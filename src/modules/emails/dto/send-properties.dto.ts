// src/modules/emails/dto/send-properties.dto.ts
import { IsArray, IsEmail, IsMongoId, ArrayNotEmpty } from 'class-validator';

export class SendPropertiesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true }) // Valida que cada elemento del array sea un ID de Mongo válido
  propertyIds: string[];

  @IsEmail()
  recipientEmail: string;
}
