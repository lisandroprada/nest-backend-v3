const { MongoClient, ObjectId } = require('mongodb');

async function resetEmailSync() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  
  const collection = client.db('nest-propietasV3').collection('users');
  
  console.log('🔄 Reseteando emailSync para resincronización completa...\n');
  
  // Buscar usuarios con emailSync
  const users = await collection.find({
    'emailSync.lastSyncedUID': { $exists: true }
  }).toArray();
  
  console.log(`Usuarios con emailSync encontrados: ${users.length}\n`);
  
  for (const user of users) {
    console.log(`Usuario: ${user.email}`);
    console.log(`  lastSyncedUID anterior: ${user.emailSync?.lastSyncedUID}`);
    
    // Resetear emailSync
    await collection.updateOne(
      { _id: user._id },
      { $unset: { emailSync: 1 } }
    );
    
    console.log(`  ✅ emailSync reseteado\n`);
  }
  
  console.log('═══════════════════════════════════════');
  console.log('✅ Reset completado');
  console.log('Ahora la próxima sincronización traerá TODO desde el principio');
  console.log('═══════════════════════════════════════\n');
  
  await client.close();
}

resetEmailSync()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
