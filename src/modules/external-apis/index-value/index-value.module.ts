import { Module } from '@nestjs/common';
import { IndexValueService } from './index-value.service';
import { IndexValueController } from './index-value.controller';
import { AuthModule } from '../../auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from 'src/common/common.module';
import { IndexValue, IndexValueSchema } from './entities/index-value.entity';
import { IndexScrapperService } from './index-scrapper/index-scrapper.service';
import { ErrorsService } from 'src/common/errors/errors.service';

@Module({
  imports: [
    AuthModule,
    CommonModule,
    MongooseModule.forFeature([
      { name: IndexValue.name, schema: IndexValueSchema },
    ]),
  ],

  controllers: [IndexValueController],
  providers: [IndexValueService, IndexScrapperService, ErrorsService],
  exports: [IndexValueService],
})
export class IndexValueModule {}
