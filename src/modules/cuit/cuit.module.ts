import { Module } from '@nestjs/common';
import { CuitController } from './cuit.controller';
import { CuitService } from './cuit.service';

@Module({
  controllers: [CuitController],
  providers: [CuitService],
  exports: [CuitService],
})
export class CuitModule {}
