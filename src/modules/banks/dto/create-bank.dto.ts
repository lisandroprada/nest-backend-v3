import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateBankDto {
  @IsString()
  @IsNotEmpty()
  bankId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['ACTIVO', 'INACTIVO'])
  @IsOptional()
  status?: string;
}
