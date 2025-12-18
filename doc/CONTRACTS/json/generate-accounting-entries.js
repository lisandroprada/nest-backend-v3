/**
 * Script para generar asientos históricos
 * 
 * Ejecuta la generación de asientos contables para todos los contratos
 * usando la estrategia FULL_HISTORY
 * 
 * Uso:
 * node generate-accounting-entries.js
 */

const { MongoClient, ObjectId } = require('mongodb');

// Configuración
const MONGO_URL = 'mongodb://localhost:27017';
const DB_NAME = 'nest-propietasV3';

// ID de usuario admin (necesario para auditoría)
const ADMIN_USER_ID = '603c0165cfb90435f8e66e04'; // Usuario admin de Propietas

async function generateAccountingEntries() {
  const client = new MongoClient(MONGO_URL);
  
  try {
    console.log('🔄 Conectando a MongoDB...\n');
    await client.connect();
    
    const db = client.db(DB_NAME);
    
    // Verificar contratos
    const contractsCount = await db.collection('contracts').countDocuments();
    console.log(`📊 Total de contratos: ${contractsCount}`);
    
    // Verificar asientos existentes
    const entriesCount = await db.collection('accountingentries').countDocuments();
    console.log(`📊 Asientos existentes: ${entriesCount}\n`);
    
    if (entriesCount > 0) {
      console.log('⚠️  Ya existen asientos contables.');
      console.log('💡 Si quieres re-generar, primero elimina los asientos existentes:');
      console.log('   db.accountingentries.deleteMany({});\n');
      return;
    }
    
    console.log('✅ Base de datos lista para migración');
    console.log('🚀 Ejecuta la migración desde el frontend o usando curl con autenticación\n');
    
    console.log('📝 Comando curl:');
    console.log('curl -X POST http://localhost:3050/api/v1/contracts/migration/generate-accounting-entries \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -H "Authorization: Bearer TU_TOKEN_AQUI" \\');
    console.log('  -d \'{"strategy": "FULL_HISTORY", "dryRun": false, "deleteExisting": false}\'');
    console.log('\n💡 Obtén tu token desde el frontend (localStorage o cookies)\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

generateAccountingEntries();
