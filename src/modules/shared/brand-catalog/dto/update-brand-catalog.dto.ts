import {PartialType} from '@nestjs/mapped-types';
import {CreateBrandCatalogDto} from './create-brand-catalog.dto';

export class UpdateBrandCatalogDto extends PartialType(CreateBrandCatalogDto) {}
