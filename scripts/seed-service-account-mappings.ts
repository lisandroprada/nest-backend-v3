/*
 * Script: seed-service-account-mappings.ts
 * Propósito: Insertar mappings iniciales en la colección `service_account_mappings`.
 * Uso: pnpm ts-node -r tsconfig-paths/register scripts/seed-service-account-mappings.ts [--update]
 * Requiere: export MONGODB (uri MongoDB)
 */
import 'reflect-metadata';
import { config as dotenv } from 'dotenv';
import mongoose from 'mongoose';
import {
  ServiceAccountMapping,
  ServiceAccountMappingSchema,
} from '../src/modules/service-account-mappings/entities/service-account-mapping.entity';

dotenv();

async function run() {
  const mongoUri = process.env.MONGODB;
  if (!mongoUri) {
    console.error('ERROR: Variable de entorno MONGODB no definida');
    process.exit(1);
  }

  await mongoose.connect(mongoUri, { dbName: undefined });

  const MappingModel = mongoose.model(
    ServiceAccountMapping.name,
    ServiceAccountMappingSchema,
  );

  const args = process.argv.slice(2);
  const forceUpdate = args.includes('--update');

  // Mappings solicitados por el usuario
  const mappings = [
    {
      provider_agent_id: '57f7de5f5c02c36dd2647313', // Camuzzi
      provider_cuit: null,
      identificador_servicio: null,
      cuenta_por_cobrar_codigo: 'CXC_SERVICIOS',
      cuenta_por_pagar_codigo: 'CXP_SERVICIOS',
      moneda: 'ARS',
      enabled: true,
      prioridad: 0,
    },
    {
      provider_agent_id: 'a6b592f61d43a8e8317819d2', // COOPERATIVA DE SERVICIOS PUBLICOS RAWSON
      provider_cuit: null,
      identificador_servicio: null,
      cuenta_por_cobrar_codigo: 'CXC_SERVICIOS',
      cuenta_por_pagar_codigo: 'CXP_SERVICIOS',
      moneda: 'ARS',
      enabled: true,
      prioridad: 0,
    },
  ];

  for (const m of mappings) {
    const existing = await MappingModel.findOne({
      provider_agent_id: new mongoose.Types.ObjectId(m.provider_agent_id),
    }).exec();
    if (existing && !forceUpdate) {
      console.log(
        `Mapping para provider ${m.provider_agent_id} ya existe. Use --update para sobrescribir.`,
      );
      continue;
    }

    if (existing && forceUpdate) {
      existing.cuenta_por_cobrar_codigo = m.cuenta_por_cobrar_codigo;
      existing.cuenta_por_pagar_codigo = m.cuenta_por_pagar_codigo;
      existing.moneda = m.moneda;
      existing.enabled = m.enabled;
      existing.prioridad = m.prioridad;
      await existing.save();
      console.log(`Mapping actualizado para provider ${m.provider_agent_id}`);
      continue;
    }

    const doc = new MappingModel({
      provider_agent_id: new mongoose.Types.ObjectId(m.provider_agent_id),
      provider_cuit: m.provider_cuit,
      identificador_servicio: m.identificador_servicio,
      cuenta_por_cobrar_codigo: m.cuenta_por_cobrar_codigo,
      cuenta_por_pagar_codigo: m.cuenta_por_pagar_codigo,
      moneda: m.moneda,
      enabled: m.enabled,
      prioridad: m.prioridad,
    });

    await doc.save();
    console.log(`Mapping creado para provider ${m.provider_agent_id}`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Error ejecutando seed:', err);
  process.exit(1);
});
