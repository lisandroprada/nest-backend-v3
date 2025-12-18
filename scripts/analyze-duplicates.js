const { MongoClient } = require('mongodb');

async function analyzeDuplicates() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  
  const collection = client.db('nest-propietasV3').collection('messages');
  
  console.log('═══════════════════════════════════════');
  console.log('🔍 ANÁLISIS DE DUPLICADOS');
  console.log('═══════════════════════════════════════\n');
  
  const total = await collection.countDocuments();
  const withMessageId = await collection.countDocuments({
    'emailMetadata.messageId': { $exists: true, $ne: null }
  });
  const withoutMessageId = total - withMessageId;
  
  console.log(`📊 Total de mensajes: ${total}`);
  console.log(`✅ Con messageId: ${withMessageId}`);
  console.log(`❌ Sin messageId: ${withoutMessageId}\n`);
  
  // Buscar duplicados sin messageId
  const dupsWithoutMessageId = await collection.aggregate([
    {
      $match: {
        $or: [
          { 'emailMetadata.messageId': { $exists: false } },
          { 'emailMetadata.messageId': null }
        ]
      }
    },
    {
      $group: {
        _id: { subject: '$subject', sender: '$sender.email', timestamp: '$timestamp' },
        count: { $sum: 1 }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    }
  ]).toArray();
  
  console.log(`🔴 Emails SIN messageId con duplicados: ${dupsWithoutMessageId.length} grupos`);
  
  if (dupsWithoutMessageId.length > 0) {
    const totalDups = dupsWithoutMessageId.reduce((sum, d) => sum + (d.count - 1), 0);
    console.log(`   Total de copias duplicadas: ${totalDups}\n`);
    
    console.log('Ejemplos:');
    dupsWithoutMessageId.slice(0, 5).forEach((d, i) => {
      console.log(`${i+1}. Subject: ${d._id.subject?.substring(0, 50)}`);
      console.log(`   Sender: ${d._id.sender}`);
      console.log(`   Copias: ${d.count}\n`);
    });
  }
  
  console.log('═══════════════════════════════════════\n');
  
  await client.close();
}

analyzeDuplicates().catch(console.error);
