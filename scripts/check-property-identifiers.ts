import { config as dotenv } from 'dotenv';
import mongoose from 'mongoose';

dotenv();

async function checkPropertyIdentifiers() {
  const mongoUri = process.env.MONGODB;
  if (!mongoUri) {
    console.error('ERROR: Variable de entorno MONGODB no definida');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  const db = mongoose.connection.db;
  const collection = db.collection('properties');

  // Buscar con ID normalizado
  console.log('=== Búsqueda con ID normalizado: 91030210800236084 ===');
  const propNormalized = await collection.findOne({
    'servicios_impuestos.identificador_servicio': '91030210800236084',
  });
  console.log(propNormalized ? '✅ ENCONTRADA' : '❌ NO ENCONTRADA');

  // Buscar con regex para encontrar variantes
  console.log('\n=== Búsqueda con regex (cualquier formato) ===');
  const propRegex = await collection.findOne({
    'servicios_impuestos.identificador_servicio': { $regex: '9103.*021.*236084' },
  });

  if (propRegex) {
    console.log('✅ ENCONTRADA con regex');
    console.log('\nIdentificadores en la propiedad:');
    propRegex.servicios_impuestos?.forEach((s: any, i: number) => {
      console.log(`  [${i}] "${s.identificador_servicio}"`);
    });
    console.log(`\nIdentificador interno: ${propRegex.identificador_interno}`);
  } else {
    console.log('❌ NO ENCONTRADA ni con regex');
  }

  // Listar todas las propiedades con servicios
  console.log('\n=== Todas las propiedades con servicios (primeras 5) ===');
  const allProps = await collection
    .find({ servicios_impuestos: { $exists: true, $ne: [] } })
    .limit(5)
    .toArray();

  allProps.forEach((p: any) => {
    console.log(`\nPropiedad: ${p.identificador_interno}`);
    p.servicios_impuestos?.forEach((s: any) => {
      console.log(`  - "${s.identificador_servicio}"`);
    });
  });

  await mongoose.disconnect();
}

checkPropertyIdentifiers().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
