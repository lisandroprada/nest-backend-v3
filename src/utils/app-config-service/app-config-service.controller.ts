import { Controller } from '@nestjs/common';
import { AppConfigServiceService } from './app-config-service.service';

@Controller('app-config-service')
export class AppConfigServiceController {
  constructor(
    private readonly appConfigServiceService: AppConfigServiceService,
  ) {}
}
