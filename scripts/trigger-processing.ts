import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ClassificationService } from '../src/modules/service-sync/services/classification.service';
import { Logger } from '@nestjs/common';

import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const connection = app.get<Connection>(getConnectionToken());
  console.log(`[ManualTrigger] Conectado a BD: ${connection.db.databaseName}`);

  const classificationService = app.get(ClassificationService);
  const logger = new Logger('ManualTrigger');

  logger.log('Buscando todas las comunicaciones SIN PROCESAR...');
  
  // Acceder al modelo directamente para buscar IDs
  // Nota: Esto es un hack porque no tenemos el modelo inyectado aquí fácilmente sin refactorizar
  // Pero podemos usar el servicio para listar si tuviera un método, o simplemente usar generateCandidates con un límite alto
  // generateCandidates sin ID procesa las pendientes si la lógica lo permite, pero revisemos el servicio.
  // El servicio generateCandidates busca:
  // const query: any = { estado_procesamiento: CommunicationStatus.UNPROCESSED };
  // Así que llamar a generateCandidates sin IDs debería procesar todo.
  
  try {
    logger.log('Iniciando procesamiento por lotes de pendientes...');
    const result = await classificationService.generateCandidates({
      maxPerRun: 100,
      tryExtractServiceId: true,
    });

    logger.log('Procesamiento completado.');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    logger.error('Error durante el procesamiento manual:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
