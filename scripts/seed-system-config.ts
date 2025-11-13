/*
 * Script: seed-system-config.ts
 * Propósito: Crear el documento singleton de configuracion_servicios (SystemConfig)
 * Uso: pnpm ts-node -r tsconfig-paths/register scripts/seed-system-config.ts
 */
import 'reflect-metadata';
import { config as dotenv } from 'dotenv';
import mongoose from 'mongoose';
import * as crypto from 'crypto';
import {
  SystemConfig,
  SystemConfigSchema,
} from '../src/modules/system-config/entities/system-config.entity';

dotenv();

async function run() {
  const mongoUri = process.env.MONGODB;
  if (!mongoUri) {
    console.error('ERROR: Variable de entorno MONGODB no definida');
    process.exit(1);
  }

  await mongoose.connect(mongoUri, {
    dbName: undefined,
  });

  const SystemConfigModel = mongoose.model(
    SystemConfig.name,
    SystemConfigSchema,
  );

  const args = process.argv.slice(2);
  const forceUpdate = args.includes('--update');

  const existing = await SystemConfigModel.findOne();
  if (existing && !forceUpdate) {
    console.log('Ya existe configuración. Use --update para sobrescribir.');
    process.exit(0);
  }

  // Credenciales provistas (fallbacks). Se recomienda usar variables de entorno IMAP_*
  const email = process.env.IMAP_EMAIL || 'lisandro.prada@ipropietas.com.ar';
  const passwordPlain = process.env.IMAP_PASSWORD || 'Sa96roemo';
  const host = process.env.IMAP_HOST || 'mail.ipropietas.com.ar';
  const port = Number(process.env.IMAP_PORT) || 993;
  const secure = (process.env.IMAP_SECURE || 'true') === 'true';
  const checkPeriod = Number(process.env.IMAP_CHECK_PERIOD_DAYS) || 7;

  // Encriptación igual que SystemConfigService (AES-256-CBC)
  const algorithm = 'aes-256-cbc';
  const key = (process.env.ENCRYPTION_KEY || 'a'.repeat(32)).slice(0, 32); // 32 bytes
  const ivString = (process.env.ENCRYPTION_IV || 'b'.repeat(16)).slice(0, 16); // 16 bytes
  const encryptionKey = Buffer.from(key, 'utf8');
  const iv = Buffer.from(ivString, 'utf8');

  const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);
  let encrypted = cipher.update(passwordPlain, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  if (existing && forceUpdate) {
    existing.email_consulta = email;
    existing.password_consulta = encrypted;
    existing.host_imap = host;
    existing.port_imap = port;
    existing.secure = secure;
    existing.check_period_days = checkPeriod;
    await existing.save();
    console.log('Configuración actualizada.');
  } else {
    const configDoc = new SystemConfigModel({
      email_consulta: email,
      password_consulta: encrypted,
      host_imap: host,
      port_imap: port,
      secure,
      check_period_days: checkPeriod,
      activo: true,
    });

    await configDoc.save();
    console.log('Configuración inicial creada.');
  }

  console.log('Resumen (sin mostrar password):');
  console.table({
    email_consulta: email,
    host_imap: host,
    port_imap: port,
    secure,
    check_period_days: checkPeriod,
  });
  console.log('IMPORTANTE: La contraseña fue almacenada encriptada.');
  console.log(
    'Para regenerar con nuevos valores: export IMAP_* y ejecutar con --update',
  );
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Error ejecutando seed:', err);
  process.exit(1);
});
