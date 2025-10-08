import { Module } from '@nestjs/common';
import { LocalityService } from './locality.service';
import { LocalityController } from './locality.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Locality, LocalitySchema } from './entities/locality.entity';
import { CommonModule } from 'src/common/common.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { ProvinceSchema, Province } from '../province/entities/province.entity';

@Module({
  imports: [
    AuthModule,
    CommonModule,
    MongooseModule.forFeature([
      { name: Locality.name, schema: LocalitySchema, collection: 'localities' },
      { name: Province.name, schema: ProvinceSchema, collection: 'provinces' },
    ]),
  ],
  controllers: [LocalityController],
  providers: [LocalityService],
})
export class LocalityModule {}
