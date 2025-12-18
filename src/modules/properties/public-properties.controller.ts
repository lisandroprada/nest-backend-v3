import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PublicPropertiesService } from './public-properties.service';
import { PublicApiGuard } from 'src/modules/auth/guards/public-api.guard';

@Controller('properties/public')
@UseGuards(PublicApiGuard)
export class PublicPropertiesController {
  constructor(private readonly publicPropertiesService: PublicPropertiesService) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.publicPropertiesService.findAllPublic(query);
  }
}
