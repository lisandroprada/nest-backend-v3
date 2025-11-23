import { Module, forwardRef } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { PropertyFilesController } from './property-files.controller';
import { PublicPropertiesController } from './public-properties.controller';
import { PropertyFilesService } from './property-files.service';
import { PublicPropertiesService } from './public-properties.service';
import { StorageService } from './services/storage.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Property, PropertySchema } from './entities/property.entity';
import { AgentsModule } from '../agents/agents.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
    ]),
    forwardRef(() => AgentsModule),
    AuthModule,
    CommonModule,
  ],
  controllers: [
    PropertiesController,
    PropertyFilesController,
    PublicPropertiesController,
  ],
  providers: [
    PropertiesService,
    PropertyFilesService,
    PublicPropertiesService,
    StorageService,
  ],
  exports: [PropertiesService],
})
export class PropertiesModule {}
