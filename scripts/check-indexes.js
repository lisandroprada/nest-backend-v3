const { MongoClient } = require('mongodb');

async function checkIndexes() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  
  const collection = client.db('nest-propietasV3').collection('messages');
  
  console.log('═══════════════════════════════════════');
  console.log('🔍 VERIFICACIÓN DE ÍNDICES');
  console.log('═══════════════════════════════════════\n');
  
  const indexes = await collection.indexes();
  
  console.log(`Total de índices: ${indexes.length}\n`);
  
  indexes.forEach((index, i) => {
    console.log(`${i + 1}. ${index.name}`);
    console.log(`   Keys: ${JSON.stringify(index.key)}`);
    if (index.unique) console.log(`   ✅ ÚNICO`);
    if (index.sparse) console.log(`   ✅ SPARSE`);
    console.log('');
  });
  
  const uniqueMessageId = indexes.find(
    idx => idx.key['emailMetadata.messageId'] && idx.unique
  );
  
  console.log('═══════════════════════════════════════');
  if (uniqueMessageId) {
    console.log('✅ Índice único en messageId CREADO');
    console.log('   Sistema listo para sincronizar sin duplicados');
  } else {
    console.log('⚠️  Índice único en messageId NO ENCONTRADO');
    console.log('   Reinicia el backend para que se cree');
  }
  console.log('═══════════════════════════════════════\n');
  
  await client.close();
}

checkIndexes().catch(console.error);
