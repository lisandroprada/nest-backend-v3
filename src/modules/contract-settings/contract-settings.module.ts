import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContractSettingsController } from './contract-settings.controller';
import { ContractSettingsService } from './contract-settings.service';
import {
  ContractSettings,
  ContractSettingsSchema,
} from './entities/contract-settings.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContractSettings.name, schema: ContractSettingsSchema },
    ]),
    AuthModule,
  ],
  controllers: [ContractSettingsController],
  providers: [ContractSettingsService],
  exports: [ContractSettingsService],
})
export class ContractSettingsModule {}
