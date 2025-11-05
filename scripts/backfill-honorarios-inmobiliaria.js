// Script para asignar agente_id de la INMOBILIARIA a partidas de honorarios sin agente
// Ejecutar con: node scripts/backfill-honorarios-inmobiliaria.js

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/nest-propietasV3';

async function run() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB');

    const db = client.db();
    const agentsCol = db.collection('agents');
    const entriesCol = db.collection('accountingentries');

    const inmo = await agentsCol.findOne({ rol: 'INMOBILIARIA' });
    if (!inmo?._id) {
      console.error('❌ No se encontró un agente con rol INMOBILIARIA.');
      console.error(
        '   Cree uno (ej. Propietas Inmobiliaria) y vuelva a ejecutar este script.',
      );
      process.exit(1);
    }
    console.log(
      `🏢 Inmobiliaria detectada: ${inmo.nombre_razon_social || inmo.nombres || inmo.apellidos || inmo._id}`,
    );

    // Filtro: partidas de HONORARIOS (haber>0 y descripcion contiene "honorarios") sin agente_id
    const filter = {
      partidas: {
        $elemMatch: {
          haber: { $gt: 0 },
          descripcion: { $regex: /honorarios/i },
          $or: [{ agente_id: { $exists: false } }, { agente_id: null }],
        },
      },
    };

    const update = {
      $set: { 'partidas.$[p].agente_id': new ObjectId(inmo._id) },
    };

    const arrayFilters = [
      {
        'p.haber': { $gt: 0 },
        'p.descripcion': { $regex: /honorarios/i },
        $or: [{ 'p.agente_id': { $exists: false } }, { 'p.agente_id': null }],
      },
    ];

    const preview = await entriesCol.countDocuments(filter);
    console.log(`🔎 Asientos a actualizar: ${preview}`);

    if (preview === 0) {
      console.log('✅ No hay partidas de honorarios pendientes de backfill.');
      return;
    }

    const result = await entriesCol.updateMany(filter, update, {
      arrayFilters,
    });
    console.log('🛠️  Resultado de actualización:', {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });

    // Validación rápida: contar cuántas partidas siguen sin agente_id
    const after = await entriesCol.countDocuments(filter);
    console.log(`📉 Pendientes después del backfill: ${after}`);
    console.log('✅ Backfill completado');
  } catch (err) {
    console.error('❌ Error en backfill:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

run();
