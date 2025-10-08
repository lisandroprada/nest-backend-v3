import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { json, urlencoded } from 'express';

import { ensureUploadDirectories } from './startup/create-upload-dirs';

ensureUploadDirectories();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(new Logger('debug'));

  // Configuración CORS restaurada y ampliada: permite frontend local, backoffice y puertos adicionales
  app.enableCors({
    origin: [
      'http://localhost:3000', // Frontend local
      'http://localhost:5174',
      'http://localhost:3001',
      'http://localhost:3002',
      'https://backoffice.netra.com.ar',
      'https://backend.netra.com.ar',
      'https://www.ipropietas.com.ar',
      'https://ipropietas.com.ar',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  });

  app.setGlobalPrefix('/api/v1');

  // Habilitar la validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remueve las propiedades que no están en los DTOs
      forbidNonWhitelisted: false, // NO Lanza error si hay propiedades no permitidas
      transform: true, // Transforma los datos de entrada a las clases de DTOs
    }),
  );

  // Aumenta el límite a 20MB (ajusta según tu necesidad)
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ limit: '20mb', extended: true }));

  await app.listen(3050);
}
bootstrap();
