import { Module } from '@nestjs/common';
import { LocalityService } from './locality.service';
import { LocalityController } from './locality.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Locality, LocalitySchema } from './entities/locality.entity';
import { CommonModule } from 'src/common/common.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { ProvinceSchema, Province } from '../province/entities/province.entity';
import { Property, PropertySchema } from 'src/modules/properties/entities/property.entity';

@Module({
  imports: [
    AuthModule,
    CommonModule,
    MongooseModule.forFeature([
      { name: Locality.name, schema: LocalitySchema, collection: 'localities' },
      { name: Province.name, schema: ProvinceSchema, collection: 'provinces' },
      { name: Property.name, schema: PropertySchema, collection: 'properties' },
    ]),
  ],
  controllers: [LocalityController],
  providers: [LocalityService],
})
export class LocalityModule {}
