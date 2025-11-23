import { config as dotenv } from 'dotenv';
import mongoose from 'mongoose';

dotenv();

async function checkServiceCommunications() {
  const mongoUri = process.env.MONGODB;
  if (!mongoUri) {
    console.error('ERROR: Variable de entorno MONGODB no definida');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  const db = mongoose.connection.db;

  // Buscar ServiceCommunications con este identificador
  console.log('=== ServiceCommunications con ID: 91030210800236084 ===\n');
  const comms = await db
    .collection('servicecommunications')
    .find({ identificador_servicio: '91030210800236084' })
    .sort({ fecha_email: -1 })
    .limit(5)
    .toArray();

  if (comms.length === 0) {
    console.log('❌ No se encontraron ServiceCommunications con este ID');
    
    // Buscar con regex
    console.log('\n=== Buscando con regex ===');
    const commsRegex = await db
      .collection('servicecommunications')
      .find({ identificador_servicio: { $regex: '9103.*021.*236084' } })
      .sort({ fecha_email: -1 })
      .limit(5)
      .toArray();
    
    if (commsRegex.length > 0) {
      console.log(`✅ Encontradas ${commsRegex.length} comunicaciones con regex`);
      commsRegex.forEach((c: any) => {
        console.log(`\n  ID: ${c._id}`);
        console.log(`  Identificador: "${c.identificador_servicio}"`);
        console.log(`  Estado: ${c.estado_procesamiento}`);
        console.log(`  Tipo: ${c.tipo_alerta}`);
        console.log(`  Gasto detectado: ${c.gasto_detectado_id || 'NO'}`);
      });
    } else {
      console.log('❌ No se encontraron ni con regex');
    }
  } else {
    console.log(`✅ Encontradas ${comms.length} comunicaciones\n`);
    comms.forEach((c: any) => {
      console.log(`ID: ${c._id}`);
      console.log(`Identificador: "${c.identificador_servicio}"`);
      console.log(`Estado: ${c.estado_procesamiento}`);
      console.log(`Tipo: ${c.tipo_alerta}`);
      console.log(`Gasto detectado: ${c.gasto_detectado_id || 'NO'}`);
      console.log(`Propiedades sugeridas: ${c.propiedades_sugeridas_ids?.length || 0}`);
      console.log('---');
    });
  }

  // Buscar DetectedExpenses
  console.log('\n=== DetectedExpenses con ID: 91030210800236084 ===\n');
  const expenses = await db
    .collection('detectedexpenses')
    .find({ identificador_servicio: '91030210800236084' })
    .sort({ fecha_deteccion: -1 })
    .limit(5)
    .toArray();

  if (expenses.length === 0) {
    console.log('❌ No se encontraron DetectedExpenses con este ID');
  } else {
    console.log(`✅ Encontrados ${expenses.length} gastos detectados\n`);
    expenses.forEach((e: any) => {
      console.log(`ID: ${e._id}`);
      console.log(`Identificador: "${e.identificador_servicio}"`);
      console.log(`Estado: ${e.estado_procesamiento}`);
      console.log(`Tipo: ${e.tipo_alerta}`);
      console.log(`Monto: ${e.monto_estimado}`);
      console.log(`Propuesta asiento: ${e.propuesta_asiento ? 'SÍ' : 'NO'}`);
      console.log('---');
    });
  }

  await mongoose.disconnect();
}

checkServiceCommunications().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
