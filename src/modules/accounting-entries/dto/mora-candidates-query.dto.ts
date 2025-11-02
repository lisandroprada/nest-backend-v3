
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common/pagination/dto/pagination.dto';

export class MoraCandidatesQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  fecha_corte?: string;
}
