import { IsEnum, IsOptional, IsString, IsArray, IsNotEmpty } from 'class-validator';

export class UpdateMessageDto {
  @IsEnum(['Nuevo', 'Leído', 'Archivado'])
  @IsOptional()
  status?: 'Nuevo' | 'Leído' | 'Archivado';

  @IsString()
  @IsOptional()
  assignedTo?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

export class UpdateStatusDto {
  @IsEnum(['Nuevo', 'Leído', 'Archivado'])
  status: 'Nuevo' | 'Leído' | 'Archivado';
}

export class AssignMessageDto {
  @IsString()
  userId: string;
}

export class AddTagsDto {
  @IsArray()
  @IsString({ each: true })
  tags: string[];
}

export class SendReplyDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  subject?: string;
}
