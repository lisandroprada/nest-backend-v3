import { IsArray, IsString } from 'class-validator';

export class BatchDeleteDto {
  @IsArray()
  @IsString({ each: true })
  messageIds: string[];
}
