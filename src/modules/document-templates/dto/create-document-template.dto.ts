import { IsString, IsNotEmpty, IsEnum } from 'class-validator';

export class CreateDocumentTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(['Contrato', 'Recibo', 'Comunicado'])
  @IsNotEmpty()
  type: string;

  @IsEnum(['oficial', 'simple'])
  @IsNotEmpty()
  headerType: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}
