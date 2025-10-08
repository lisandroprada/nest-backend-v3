import { Module } from '@nestjs/common';
import { AppConfigServiceService } from './app-config-service.service';
import { AppConfigServiceController } from './app-config-service.controller';

@Module({
  controllers: [AppConfigServiceController],
  providers: [AppConfigServiceService],
  exports: [AppConfigServiceService],
})
export class AppConfigServiceModule {}
