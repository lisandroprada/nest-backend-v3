import { IsMongoId, IsNotEmpty } from 'class-validator';

export class CreatePropertyInventoryDto {
  @IsMongoId()
  @IsNotEmpty()
  property_id: string;
}
