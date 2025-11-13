import { IsString } from 'class-validator';

export class SendWhatsAppDto {
  @IsString()
  phoneNumber: string;

  @IsString()
  receiptId: string;
}
