import { PartialType } from '@nestjs/mapped-types';
import { CreateIndexValueDto } from './create-index-value.dto';

export class UpdateIndexValueDto extends PartialType(CreateIndexValueDto) {}
