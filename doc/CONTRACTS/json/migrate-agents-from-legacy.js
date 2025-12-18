/**
 * Script mejorado para migrar agentes uno por uno
 */

const { MongoClient } = require('mongodb');

const MONGO_URL = 'mongodb://127.0.0.1:27017';
const LEGACY_DB = 'propietas';
const V3_DB = 'nest-propietasV3';

async function migrateAgents() {
  const client = new MongoClient(MONGO_URL);
  
  try {
    console.log('🔄 Conectando a MongoDB...\n');
    await client.connect();
    
    const legacyDb = client.db(LEGACY_DB);
    const v3Db = client.db(V3_DB);
    
    // Obtener agentes de legacy
    const legacyAgents = await legacyDb.collection('agents').find({}).toArray();
    console.log(`📥 Agentes en legacy: ${legacyAgents.length}`);
    
    // Limpiar colección V3
    await v3Db.collection('agents').deleteMany({});
    console.log('✅ Colección agents limpiada\n');
    
    console.log('🔄 Migrando agentes uno por uno...\n');
    
    let inserted = 0;
    let errors = 0;
    
    for (const agent of legacyAgents) {
      try {
        const transformedAgent = {
          _id: agent._id, // Mantener _id original
          nombre_completo: agent.fullName || '',
          email_principal: agent.email || '',
          telefono: agent.phone || '',
          dni: agent.identityCard || '',
          direccion: agent.address || '',
          ciudad: agent.city?.nombre || '',
          provincia: agent.state?.nombre || '',
          tipo: 'PERSONA_FISICA',
          roles: [],
          createdAt: agent.createdAt || new Date(),
          updatedAt: agent.updatedAt || new Date()
        };
        
        await v3Db.collection('agents').insertOne(transformedAgent);
        inserted++;
        
        if (inserted % 100 === 0) {
          console.log(`  Progreso: ${inserted}/${legacyAgents.length}...`);
        }
      } catch (error) {
        errors++;
        if (errors < 5) {
          console.error(`Error con agente ${agent._id}:`, error.message);
        }
      }
    }
    
    console.log(`\n✅ Migración completada:`);
    console.log(`   Insertados: ${inserted}`);
    console.log(`   Errores: ${errors}`);
    console.log(`   Total: ${legacyAgents.length}\n`);
    
    // Verificar agente específico
    const testAgent = await v3Db.collection('agents').findOne({ _id: require('mongodb').ObjectId('68fa1886bbb2614a30d96559') });
    console.log('🔍 Verificando agente 68fa1886bbb2614a30d96559:');
    console.log('   ', testAgent ? '✅ EXISTE' : '❌ NO EXISTE');
    if (testAgent) {
      console.log('    Nombre:', testAgent.nombre_completo);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

migrateAgents();
