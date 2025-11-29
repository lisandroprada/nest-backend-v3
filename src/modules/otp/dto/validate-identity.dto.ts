import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class ValidateIdentityDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{7,11}$/, {
    message: 'DNI/CUIT debe tener entre 7 y 11 dígitos',
  })
  dni: string;

  @IsString()
  @IsNotEmpty()
  whatsappJid: string;
}
