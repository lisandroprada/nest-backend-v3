import { IsEmail, IsString } from 'class-validator';

export class SendEmailDto {
  @IsEmail()
  email: string;

  @IsString()
  receiptId: string;
}
