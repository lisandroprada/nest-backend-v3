import { IsArray, IsEnum, IsString } from 'class-validator';
import { MessageStatus } from '../entities/message.entity';

export class BatchUpdateStatusDto {
  @IsArray()
  @IsString({ each: true })
  messageIds: string[];

  @IsEnum(['Nuevo', 'Leído', 'Archivado'])
  status: MessageStatus;
}
