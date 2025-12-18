const { MongoClient } = require('mongodb');

async function checkDuplicatesBySubject() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  
  const collection = client.db('nest-propietasV3').collection('messages');
  
  // Buscar duplicados por subject + timestamp
  const duplicates = await collection.aggregate([
    {
      $group: {
        _id: { subject: '$subject', sender: '$sender.email' },
        count: { $sum: 1 },
        docs: { $push: { id: '$_id', timestamp: '$timestamp', messageId: '$emailMetadata.messageId' } }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    }
  ]).toArray();
  
  console.log('═══════════════════════════════════════');
  console.log('🔍 DUPLICADOS POR SUBJECT + SENDER');
  console.log('═══════════════════════════════════════\n');
  
  if (duplicates.length === 0) {
    console.log('✅ No se encontraron duplicados\n');
  } else {
    console.log(`⚠️  Encontrados ${duplicates.length} grupos de duplicados\n`);
    
    duplicates.slice(0, 5).forEach((dup, i) => {
      console.log(`${i+1}. Subject: ${dup._id.subject?.substring(0, 60)}`);
      console.log(`   Sender: ${dup._id.sender}`);
      console.log(`   Cantidad: ${dup.count} copias`);
      console.log(`   IDs:`);
      dup.docs.forEach(d => {
        console.log(`     - ${d.id} | MessageID: ${d.messageId || 'NULL'}`);
      });
      console.log('');
    });
    
    if (duplicates.length > 5) {
      console.log(`   ... y ${duplicates.length - 5} grupos más\n`);
    }
  }
  
  await client.close();
}

checkDuplicatesBySubject().catch(console.error);
