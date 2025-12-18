const { MongoClient } = require('mongodb');

async function verifySync() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  
  const db = client.db('nest-propietasV3');
  const messagesCollection = db.collection('messages');
  const usersCollection = db.collection('users');
  
  console.log('═══════════════════════════════════════');
  console.log('✅ VERIFICACIÓN POST-SINCRONIZACIÓN');
  console.log('═══════════════════════════════════════\n');
  
  // 1. Contar mensajes
  const totalMessages = await messagesCollection.countDocuments();
  console.log(`📧 Total de mensajes: ${totalMessages}`);
  
  // 2. Verificar duplicados
  const duplicates = await messagesCollection.aggregate([
    {
      $group: {
        _id: { subject: '$subject', sender: '$sender.email' },
        count: { $sum: 1 }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    }
  ]).toArray();
  
  console.log(`🔍 Duplicados encontrados: ${duplicates.length}`);
  
  // 3. Verificar emailSync del usuario
  const userWithSync = await usersCollection.findOne({
    'emailSync.lastSyncedUID': { $exists: true }
  });
  
  if (userWithSync) {
    console.log(`\n👤 Usuario con sincronización:`);
    console.log(`   ID: ${userWithSync._id}`);
    console.log(`   Email: ${userWithSync.email}`);
    console.log(`   Último UID: ${userWithSync.emailSync?.lastSyncedUID || 'N/A'}`);
    console.log(`   Última sync: ${userWithSync.emailSync?.lastSyncDate || 'N/A'}`);
  } else {
    console.log(`\n⚠️  No se encontró usuario con emailSync actualizado`);
  }
  
  // 4. Muestra de mensajes
  const sample = await messagesCollection.find().limit(3).toArray();
  console.log(`\n📋 Muestra de mensajes (primeros 3):`);
  sample.forEach((m, i) => {
    console.log(`\n${i+1}. ID: ${m._id}`);
    console.log(`   Subject: ${(m.subject || '').substring(0, 60)}`);
    console.log(`   Source: ${m.source}`);
    console.log(`   Timestamp: ${m.timestamp}`);
  });
  
  console.log('\n═══════════════════════════════════════');
  if (totalMessages > 0 && duplicates.length === 0 && userWithSync) {
    console.log('✅ SINCRONIZACIÓN EXITOSA');
    console.log('   - Mensajes sincronizados correctamente');
    console.log('   - Sin duplicados');
    console.log('   - Usuario con UID tracking actualizado');
  } else {
    console.log('⚠️  REVISAR SINCRONIZACIÓN');
    if (totalMessages === 0) console.log('   - No hay mensajes');
    if (duplicates.length > 0) console.log(`   - ${duplicates.length} duplicados encontrados`);
    if (!userWithSync) console.log('   - Usuario sin UID tracking');
  }
  console.log('═══════════════════════════════════════\n');
  
  await client.close();
}

verifySync().catch(console.error);
