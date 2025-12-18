import { IsString, IsEmail, IsNotEmpty, IsEnum, IsOptional, IsNumber, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ImapConfigDto {
  @IsString()
  @IsNotEmpty()
  host: string;

  @IsNumber()
  port: number;

  @IsString()
  @IsNotEmpty()
  user: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsBoolean()
  @IsOptional()
  tls?: boolean;
}

export class UpdateEmailConfigDto {
  @IsEmail()
  @IsOptional()
  emailCorporativo?: string;

  @IsEnum(['GMAIL', 'OUTLOOK', 'IMAP'])
  @IsOptional()
  provider?: 'GMAIL' | 'OUTLOOK' | 'IMAP';

  @ValidateNested()
  @Type(() => ImapConfigDto)
  @IsOptional()
  imapConfig?: ImapConfigDto;

  @IsBoolean()
  @IsOptional()
  sincronizacionActiva?: boolean;
}
