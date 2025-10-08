import { Module } from '@nestjs/common';
import { UniqueIdServiceService } from './unique-id-service.service';

@Module({
  providers: [UniqueIdServiceService], // Registrar el servicio
  exports: [UniqueIdServiceService], // Exportar el servicio para que pueda ser usado en otros módulos
})
export class UniqueIdModule {}
