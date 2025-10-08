import { IsString, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { SearchOperation } from './search-operations.enum';

export class SearchCriteriaDto {
  @IsString()
  field: string;
  @IsString()
  term: string;
  @IsEnum(SearchOperation)
  operation: SearchOperation;
}

export class AdvancedSearchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SearchCriteriaDto)
  criteria: SearchCriteriaDto[];
}
