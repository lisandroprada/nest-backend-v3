import { IsString, IsNotEmpty, IsEnum, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class TemplateDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(['oficial', 'simple'])
  @IsNotEmpty()
  headerType: string;
}

class ContextDto {
  @IsEnum(['contract'])
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  id: string;
}

export class GenerateDocumentDto {
  @IsObject()
  @ValidateNested()
  @Type(() => TemplateDto)
  template: TemplateDto;

  @IsObject()
  @ValidateNested()
  @Type(() => ContextDto)
  context: ContextDto;
}
