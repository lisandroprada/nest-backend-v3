import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServiceAccountMappingsService } from './service-account-mappings.service';
import { ServiceAccountMappingsController } from './service-account-mappings.controller';
import {
  ServiceAccountMapping,
  ServiceAccountMappingSchema,
} from './entities/service-account-mapping.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ServiceAccountMapping.name, schema: ServiceAccountMappingSchema },
    ]),
  ],
  providers: [ServiceAccountMappingsService],
  controllers: [ServiceAccountMappingsController],
  exports: [ServiceAccountMappingsService],
})
export class ServiceAccountMappingsModule {}
