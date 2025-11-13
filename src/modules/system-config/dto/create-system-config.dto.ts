import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class CreateSystemConfigDto {
  @IsString()
  email_consulta: string;

  @IsString()
  password_consulta: string;

  @IsString()
  host_imap: string;

  @IsNumber()
  @Min(1)
  @Max(65535)
  port_imap: number;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(30)
  check_period_days?: number;
}
