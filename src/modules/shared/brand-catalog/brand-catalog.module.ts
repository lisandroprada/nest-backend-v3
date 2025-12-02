import {Module} from '@nestjs/common';
import {MongooseModule} from '@nestjs/mongoose';
import {BrandCatalogService} from './brand-catalog.service';
import {BrandCatalogController} from './brand-catalog.controller';
import {BrandCatalog, BrandCatalogSchema} from './entities/brand-catalog.entity';

@Module({
  imports: [
    MongooseModule.forFeature([{name: BrandCatalog.name, schema: BrandCatalogSchema}]),
  ],
  controllers: [BrandCatalogController],
  providers: [BrandCatalogService],
  exports: [BrandCatalogService],
})
export class BrandCatalogModule {}
