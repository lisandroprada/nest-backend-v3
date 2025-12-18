import {
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { AdvancedSearchDto } from './advanced-search.dto';

export class PaginationDto {
  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  @Min(1)
  pageSize?: number = 10;

  @IsOptional()
  @Min(0)
  @Type(() => Number)
  page?: number = 0;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  populate?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdvancedSearchDto)
  search?: AdvancedSearchDto;
}
