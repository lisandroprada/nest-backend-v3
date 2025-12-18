/**
 * Script para ejecutar la migración de asientos históricos
 * sin necesidad de autenticación HTTP
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = 'mongodb://localhost:27017';
const DB_NAME = 'nest-propietasV3';

async function executeMigration() {
  const client = new MongoClient(MONGO_URL);
  
  try {
    console.log('🚀 Iniciando migración de asientos históricos...\n');
    await client.connect();
    
    const db = client.db(DB_NAME);
    
    // Verificar estado inicial
    const contractsCount = await db.collection('contracts').countDocuments();
    const entriesCount = await db.collection('accountingentries').countDocuments();
    
    console.log('📊 Estado inicial:');
    console.log(`   Contratos: ${contractsCount}`);
    console.log(`   Asientos existentes: ${entriesCount}\n`);
    
    if (entriesCount > 0) {
      console.log('⚠️  Ya existen asientos. Eliminando...');
      await db.collection('accountingentries').deleteMany({});
      console.log('✅ Asientos eliminados\n');
    }
    
    console.log('✅ Base de datos lista');
    console.log('\n🎯 Ahora ejecuta la migración desde el frontend:');
    console.log('   POST http://localhost:3050/api/v1/contracts/migration/generate-accounting-entries');
    console.log('   Body: {"strategy": "FULL_HISTORY", "dryRun": false, "deleteExisting": false}\n');
    
    console.log('💡 O usa este comando curl (necesitas el token de autenticación):');
    console.log('   curl -X POST http://localhost:3050/api/v1/contracts/migration/generate-accounting-entries \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -H "Authorization: Bearer TU_TOKEN" \\');
    console.log('     -d \'{"strategy": "FULL_HISTORY", "dryRun": false, "deleteExisting": false}\'\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

executeMigration();
