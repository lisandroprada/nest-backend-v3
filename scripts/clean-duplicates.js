const { MongoClient } = require('mongodb');

async function cleanDuplicates() {
  console.log('🧹 Iniciando limpieza de emails duplicados...\n');

  const uri = 'mongodb://localhost:27017';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✓ Conectado a MongoDB\n');

    const db = client.db('nest-propietasV3');
    const collection = db.collection('messages');

    // Encontrar todos los messageIds duplicados
    const duplicates = await collection.aggregate([
      {
        $match: {
          'emailMetadata.messageId': { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$emailMetadata.messageId',
          count: { $sum: 1 },
          docs: { $push: { id: '$_id', timestamp: '$timestamp' } },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
    ]).toArray();

    console.log(`📊 Encontrados ${duplicates.length} emails con duplicados\n`);

    if (duplicates.length === 0) {
      console.log('✅ No hay duplicados para limpiar');
      await client.close();
      return;
    }

    let totalDeleted = 0;
    let totalDocs = 0;

    for (const dup of duplicates) {
      totalDocs += dup.count;
      
      // Ordenar por timestamp descendente (más reciente primero)
      const sorted = dup.docs.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );

      // Mantener el primero (más reciente), eliminar el resto
      const toDelete = sorted.slice(1).map(d => d.id);

      console.log(`📧 MessageId: ${dup._id.substring(0, 40)}...`);
      console.log(`   Duplicados: ${dup.count}`);
      console.log(`   Manteniendo: ${sorted[0].id}`);
      console.log(`   Eliminando: ${toDelete.length} copias`);

      const result = await collection.deleteMany({
        _id: { $in: toDelete },
      });

      totalDeleted += result.deletedCount;
      console.log(`   ✓ Eliminados: ${result.deletedCount}\n`);
    }

    console.log('═══════════════════════════════════════');
    console.log(`✅ Limpieza completada`);
    console.log(`📊 Total de documentos analizados: ${totalDocs}`);
    console.log(`🗑️  Total de duplicados eliminados: ${totalDeleted}`);
    console.log(`📧 Emails únicos mantenidos: ${duplicates.length}`);
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    throw error;
  } finally {
    await client.close();
    console.log('✓ Desconectado de MongoDB');
  }
}

cleanDuplicates()
  .then(() => {
    console.log('\n🎉 Script finalizado con éxito');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
