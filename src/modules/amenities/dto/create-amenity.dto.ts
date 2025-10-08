import { IsString, IsNotEmpty } from 'class-validator';

export class CreateAmenityDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  categoria: string;
}