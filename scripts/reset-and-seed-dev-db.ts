import 'reflect-metadata';
import { config as dotenv } from 'dotenv';
import mongoose from 'mongoose';
import {
  Agent,
  AgentSchema,
} from '../src/modules/agents/entities/agent.entity';
import {
  ServiceAccountMapping,
  ServiceAccountMappingSchema,
} from '../src/modules/service-account-mappings/entities/service-account-mapping.entity';
import {
  ServiceCommunication,
  ServiceCommunicationSchema,
} from '../src/modules/service-sync/entities/service-communication.entity';
import {
  DetectedExpense,
  DetectedExpenseSchema,
} from '../src/modules/detected-expenses/entities/detected-expense.entity';

dotenv();

async function run() {
  const mongoUri =
    process.env.MONGODB || 'mongodb://localhost:27017/nest-propietasV3';
  console.log('Connecting to', mongoUri);
  await mongoose.connect(mongoUri, { dbName: undefined });

  // Register models
  const AgentModel = mongoose.model(Agent.name, AgentSchema);
  const MappingModel = mongoose.model(
    ServiceAccountMapping.name,
    ServiceAccountMappingSchema,
  );
  const CommModel = mongoose.model(
    ServiceCommunication.name,
    ServiceCommunicationSchema,
  );
  const DetectedModel = mongoose.model(
    DetectedExpense.name,
    DetectedExpenseSchema,
  );

  console.log(
    'Dropping collections (if exist): agents, service_account_mappings, service_communications, detectedexpenses',
  );
  try {
    await Promise.all([
      AgentModel.collection.drop().catch(() => {}),
      MappingModel.collection.drop().catch(() => {}),
      CommModel.collection.drop().catch(() => {}),
      DetectedModel.collection.drop().catch(() => {}),
    ]);
  } catch (e) {
    // ignore
  }

  console.log('Seeding Agent for CUIT 30657864427');
  const agentId = new mongoose.Types.ObjectId('57f7de5f5c02c36dd2647313');
  await AgentModel.create({
    _id: agentId,
    identificador_fiscal: '30657864427',
    nombre_razon_social: 'CAMUZZI',
    persona_tipo: 'JURIDICA',
    nomenclador_fiscal: 'RI',
    direccion_fiscal: {
      provincia_id: new mongoose.Types.ObjectId(),
      localidad_id: new mongoose.Types.ObjectId(),
    },
    status: 'ACTIVO',
  });

  console.log('Seeding owner Agent (propietario)');
  const ownerId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  await AgentModel.create({
    _id: ownerId,
    identificador_fiscal: '20304050607',
    nombre_razon_social: 'PROPIETARIO TEST',
    persona_tipo: 'FISICA',
    nomenclador_fiscal: 'RI',
    direccion_fiscal: {
      provincia_id: new mongoose.Types.ObjectId(),
      localidad_id: new mongoose.Types.ObjectId(),
    },
    status: 'ACTIVO',
  });

  console.log('Seeding ServiceAccountMapping for Camuzzi');
  await MappingModel.create({
    provider_agent_id: agentId,
    provider_cuit: '30657864427',
    identificador_servicio: null,
    cuenta_egreso_codigo: 'EGRESO_SERV_GAS',
    cuenta_a_pagar_codigo: 'PAS_PROV_GAS',
    moneda: 'ARS',
    enabled: true,
    prioridad: 0,
  });

  console.log('Creating sample ServiceCommunication (to be processed)');
  const sampleComm = await CommModel.create({
    email_id: `seed-${Date.now()}@example.com`,
    proveedor_cuit: '30657864427',
    remitente: 'facturas@camuzzi.com',
    asunto: 'Factura mensual - Cuenta 9103/0-04-04-0013178/8',
    cuerpo_texto:
      'Estimado cliente. Nro. Cuenta: 9103/0-04-04-0013178/8. Importe: $1234',
    fecha_email: new Date(),
    tipo_alerta: 'FACTURA_DISPONIBLE',
    identificador_servicio: '9103/0-04-04-0013178/8',
    monto_estimado: 1234,
    estado_procesamiento: 'UNPROCESSED',
  });

  // Create a Property that references the owner and the provider service identifier
  console.log(
    'Seeding Property for identificador_servicio',
    sampleComm.identificador_servicio,
  );
  // Seed minimal ChartOfAccounts entries required by the mapping
  try {
    const ChartSchema =
      require('../src/modules/chart-of-accounts/entities/chart-of-account.entity').ChartOfAccountSchema;
    const ChartModel = mongoose.model('ChartOfAccount', ChartSchema);
    console.log('Seeding ChartOfAccounts entries for mapping codes');
    await Promise.all([
      ChartModel.create({
        codigo: 'EGRESO_SERV_GAS',
        nombre: 'Egreso - Servicios Gas',
        tipo_cuenta: 'EGRESO',
        es_imputable: true,
      }),
      ChartModel.create({
        codigo: 'PAS_PROV_GAS',
        nombre: 'Pasivo - Proveedor Gas',
        tipo_cuenta: 'PASIVO',
        es_imputable: true,
      }),
    ]).catch(() => {});
    console.log('ChartOfAccounts seeded');
  } catch (err) {
    console.warn(
      'Could not seed ChartOfAccounts (schema import may differ). Error:',
      err.message || err,
    );
  }
  try {
    const PropertySchema =
      require('../src/modules/properties/entities/property.entity').PropertySchema;
    const PropertyModel = mongoose.model('Property', PropertySchema);
    await PropertyModel.create({
      propietarios_ids: [ownerId],
      identificador_interno: `seed-prop-${Date.now()}`,
      servicios_impuestos: [
        {
          proveedor_id: agentId,
          identificador_servicio: sampleComm.identificador_servicio,
          porcentaje_aplicacion: 100,
          origen: 'LOCATARIO',
          destino: 'PRESTADOR',
        },
      ],
    });
    console.log('Property seeded');
  } catch (err) {
    console.warn(
      'Could not create Property (schema import may differ). Error:',
      err.message || err,
    );
  }

  console.log(
    'Seed complete. Sample communication id:',
    sampleComm._id.toString(),
  );
  console.log(
    'Next: run the generateCandidates endpoint for that communication id, or let the automatic flow process it.',
  );

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Error running seed:', err);
  process.exit(1);
});
