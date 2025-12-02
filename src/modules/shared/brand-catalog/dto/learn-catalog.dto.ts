import {IsString, IsOptional} from 'class-validator';

export class LearnCatalogDto {
  @IsString()
  categoria: string;

  @IsOptional()
  @IsString()
  marca?: string;

  @IsOptional()
  @IsString()
  modelo?: string;
}
