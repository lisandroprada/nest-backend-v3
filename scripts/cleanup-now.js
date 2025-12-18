const { MongoClient, ObjectId } = require('mongodb');

async function cleanDuplicatesBySubject() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  
  const collection = client.db('nest-propietasV3').collection('messages');
  
  console.log('🧹 Iniciando limpieza de duplicados por Subject + Sender...\n');
  
  // Buscar duplicados por subject + sender
  const duplicates = await collection.aggregate([
    {
      $group: {
        _id: { subject: '$subject', sender: '$sender.email' },
        count: { $sum: 1 },
        docs: { $push: { id: '$_id', timestamp: '$timestamp' } }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    }
  ]).toArray();
  
  console.log(`📊 Encontrados ${duplicates.length} grupos de duplicados\n`);
  
  if (duplicates.length === 0) {
    console.log('✅ No hay duplicados para limpiar');
    await client.close();
    return;
  }
  
  let totalDeleted = 0;
  
  for (const dup of duplicates) {
    // Ordenar por timestamp descendente (más reciente primero)
    const sorted = dup.docs.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    // Mantener el primero (más reciente), eliminar el resto
    const toDelete = sorted.slice(1).map(d => new ObjectId(d.id));
    
    const result = await collection.deleteMany({
      _id: { $in: toDelete }
    });
    
    totalDeleted += result.deletedCount;
    
    if (dup.count > 10) {
      // Solo mostrar grupos grandes
      console.log(`📧 Subject: ${dup._id.subject?.substring(0, 50)}...`);
      console.log(`   Sender: ${dup._id.sender}`);
      console.log(`   Eliminados: ${result.deletedCount} de ${dup.count} copias\n`);
    }
  }
  
  console.log('═══════════════════════════════════════');
  console.log(`✅ LIMPIEZA COMPLETADA`);
  console.log(`🗑️  Total eliminados: ${totalDeleted} duplicados`);
  console.log(`📧 Grupos procesados: ${duplicates.length}`);
  console.log('═══════════════════════════════════════\n');
  
  await client.close();
}

cleanDuplicatesBySubject()
  .then(() => {
    console.log('🎉 Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
