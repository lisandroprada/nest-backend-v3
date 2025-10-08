import { IsNotEmpty, IsNumber, IsString, IsDate } from 'class-validator';

export class CreateIndexValueDto {
  @IsNotEmpty()
  @IsString()
  formula: string;

  @IsNotEmpty()
  @IsNumber()
  value: number;

  @IsNotEmpty()
  @IsDate()
  date: Date;

  @IsNotEmpty()
  @IsNumber()
  year: number;

  @IsNotEmpty()
  @IsString()
  month: string;

  @IsNotEmpty()
  @IsNumber()
  day: number;
}
