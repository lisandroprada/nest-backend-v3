import { config as dotenv } from 'dotenv';
import mongoose from 'mongoose';

dotenv();

async function checkRecentCommunications() {
  const mongoUri = process.env.MONGODB;
  if (!mongoUri) {
    console.error('ERROR: Variable de entorno MONGODB no definida');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  const db = mongoose.connection.db;

  // Últimas 10 ServiceCommunications
  console.log('=== Últimas 10 ServiceCommunications ===\n');
  const comms = await db
    .collection('servicecommunications')
    .find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  comms.forEach((c: any, i: number) => {
    console.log(`[${i + 1}] ID: ${c._id}`);
    console.log(`    Identificador: "${c.identificador_servicio || 'SIN IDENTIFICADOR'}"`);
    console.log(`    Estado: ${c.estado_procesamiento}`);
    console.log(`    Tipo: ${c.tipo_alerta}`);
    console.log(`    Asunto: ${c.asunto?.substring(0, 60)}...`);
    console.log(`    Fecha: ${c.fecha_email || c.createdAt}`);
    console.log(`    Gasto: ${c.gasto_detectado_id ? 'SÍ' : 'NO'}`);
    console.log(`    Props sugeridas: ${c.propiedades_sugeridas_ids?.length || 0}`);
    console.log('');
  });

  // Últimos 10 DetectedExpenses
  console.log('\n=== Últimos 10 DetectedExpenses ===\n');
  const expenses = await db
    .collection('detectedexpenses')
    .find({})
    .sort({ fecha_deteccion: -1 })
    .limit(10)
    .toArray();

  expenses.forEach((e: any, i: number) => {
    console.log(`[${i + 1}] ID: ${e._id}`);
    console.log(`    Identificador: "${e.identificador_servicio || 'SIN IDENTIFICADOR'}"`);
    console.log(`    Estado: ${e.estado_procesamiento}`);
    console.log(`    Tipo: ${e.tipo_alerta}`);
    console.log(`    Monto: ${e.monto_estimado}`);
    console.log(`    Fecha: ${e.fecha_deteccion}`);
    console.log(`    Propuesta: ${e.propuesta_asiento ? 'SÍ' : 'NO'}`);
    console.log('');
  });

  await mongoose.disconnect();
}

checkRecentCommunications().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
