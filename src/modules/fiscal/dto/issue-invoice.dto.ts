import { IsArray, IsMongoId, IsNotEmpty } from 'class-validator';

export class IssueInvoiceDto {
  @IsArray()
  @IsMongoId({ each: true })
  @IsNotEmpty()
  asientos_asociados_ids: string[];
}
