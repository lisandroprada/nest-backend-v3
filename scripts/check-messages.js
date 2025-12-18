const { MongoClient } = require('mongodb');

async function checkDuplicates() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  
  const collection = client.db('nest-propietasV3').collection('messages');
  
  const total = await collection.countDocuments();
  const withMessageId = await collection.countDocuments({
    'emailMetadata.messageId': { $exists: true, $ne: null }
  });
  
  const sample = await collection.find().limit(5).toArray();
  
  console.log('═══════════════════════════════════════');
  console.log('📊 ESTADO DE LA COLECCIÓN DE MENSAJES');
  console.log('═══════════════════════════════════════\n');
  console.log(`Total de mensajes: ${total}`);
  console.log(`Mensajes con messageId: ${withMessageId}`);
  console.log(`Mensajes sin messageId: ${total - withMessageId}\n`);
  
  console.log('Muestra de mensajes:');
  console.log('───────────────────────────────────────\n');
  
  sample.forEach((m, i) => {
    console.log(`${i+1}. _id: ${m._id}`);
    console.log(`   Subject: ${(m.subject || '').substring(0, 60)}`);
    console.log(`   Source: ${m.source}`);
    console.log(`   MessageId: ${m.emailMetadata?.messageId || 'NULL'}`);
    console.log(`   Timestamp: ${m.timestamp}\n`);
  });
  
  await client.close();
}

checkDuplicates().catch(console.error);
