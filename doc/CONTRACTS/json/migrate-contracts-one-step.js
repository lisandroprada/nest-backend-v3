/**
 * Script de migración completa: JSON Legacy → MongoDB V3
 * 
 * Este script hace TODO en un solo paso:
 * 1. Lee el JSON del sistema legacy
 * 2. Transforma cada contrato al formato V3
 * 3. Inserta en MongoDB
 * 
 * Uso:
 * node migrate-contracts-one-step.js
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Configuración
const MONGO_URL = 'mongodb://localhost:27017';
const DB_NAME = 'nest-propietasV3';
const JSON_FILE = path.join(__dirname, 'propietas.leaseagreements.json');

// Función de transformación
function transformContract(legacyContract) {
  return {
    // IDs y referencias
    propiedad_id: legacyContract.property?._id?.$oid || null,
    
    // Partes del contrato
    partes: [
      // Locatarios
      ...(legacyContract.tenant || []).map(t => ({
        agente_id: t._id?.$oid,
        rol: 'LOCATARIO'
      })),
      // Locadores
      ...(legacyContract.leaseHolder || []).map(lh => ({
        agente_id: lh._id?.$oid,
        rol: 'LOCADOR'
      })),
      // Garantes
      ...(legacyContract.guarantor || []).map(g => ({
        agente_id: g._id?.$oid,
        rol: 'GARANTE'
      }))
    ].filter(p => p.agente_id), // Filtrar partes sin ID
    
    // Fechas
    fecha_inicio: legacyContract.startDate?.$date ? new Date(legacyContract.startDate.$date) : null,
    fecha_final: legacyContract.expiresAt?.$date ? new Date(legacyContract.expiresAt.$date) : null,
    duracion_meses: legacyContract.length || 24,
    
    // Estado
    status: legacyContract.status === true ? 'VIGENTE' : 'RESCINDIDO',
    
    // Términos financieros
    terminos_financieros: {
      monto_base_vigente: legacyContract.rentAmount || 0,
      indice_tipo: legacyContract.rentIncreaseType === 'ICL' ? 'ICL' : 
                   legacyContract.rentIncreaseType === 'IPC' ? 'IPC' : 'FIJO',
      interes_mora_diaria: legacyContract.interest || 0,
      iva_calculo_base: 'INCLUIDO',
      
      comision_administracion_porcentaje: legacyContract.adminFee || 7,
      
      honorarios_locador_porcentaje: legacyContract.leaseHolderFee || 0,
      honorarios_locador_cuotas: legacyContract.leaseHolderAmountOfFees || 1,
      honorarios_locatario_porcentaje: legacyContract.tenantFee || 0,
      honorarios_locatario_cuotas: legacyContract.tenantAmountOfFees || 1,
      
      ajuste_porcentaje: legacyContract.rentIncreaseFixed || 0,
      ajuste_periodicidad_meses: legacyContract.rentIncreasePeriod || 12,
      ajuste_es_fijo: legacyContract.rentIncreaseType === 'FIJO',
      indice_valor_inicial: legacyContract.icl || 0
    },
    
    // Depósito
    deposito_monto: legacyContract.depositAmount || 0,
    deposito_cuotas: legacyContract.depositLength || 1,
    deposito_tipo_ajuste: legacyContract.depositType === 'Efectivo' ? 'AL_ORIGEN' : 'AL_ULTIMO_ALQUILER',
    
    // Tipo y uso
    tipo_contrato: legacyContract.type || 'Vivienda',
    uso_propiedad: legacyContract.use || 'Vivienda Única',
    
    // Hitos (por defecto false para contratos migrados)
    firmas_completas: false,
    documentacion_completa: false,
    visita_realizada: false,
    inventario_actualizado: false,
    fotos_inventario: [],
    
    // Auditoría
    createdAt: legacyContract.createdAt?.$date ? new Date(legacyContract.createdAt.$date) : new Date(),
    updatedAt: legacyContract.changedAt?.$date ? new Date(legacyContract.changedAt.$date) : new Date()
  };
}

async function migrateContracts() {
  const client = new MongoClient(MONGO_URL);
  
  try {
    console.log('🔄 Iniciando migración completa...\n');
    
    // Conectar a MongoDB
    await client.connect();
    console.log('✅ Conectado a MongoDB\n');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('contracts');
    
    // Leer JSON
    console.log('📖 Leyendo archivo JSON...');
    const jsonData = fs.readFileSync(JSON_FILE, 'utf8');
    const legacyContracts = JSON.parse(jsonData);
    console.log(`✅ ${legacyContracts.length} contratos encontrados\n`);
    
    // Limpiar colección (opcional)
    const existingCount = await collection.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️  La colección ya tiene ${existingCount} documentos`);
      console.log('❌ Abortando para evitar duplicados');
      console.log('💡 Elimina la colección manualmente si quieres re-migrar\n');
      return;
    }
    
    // Transformar e insertar
    console.log('🔄 Transformando e insertando contratos...\n');
    const transformedContracts = legacyContracts.map(transformContract);
    
    // Insertar en lotes de 100
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < transformedContracts.length; i += batchSize) {
      const batch = transformedContracts.slice(i, i + batchSize);
      await collection.insertMany(batch);
      inserted += batch.length;
      console.log(`✅ Progreso: ${inserted}/${transformedContracts.length} contratos insertados...`);
    }
    
    console.log(`\n📊 Resumen:`);
    console.log(`   ✅ Contratos migrados: ${inserted}`);
    console.log(`   📝 Total en JSON: ${legacyContracts.length}`);
    console.log(`\n✨ Migración completada exitosamente!\n`);
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

// Ejecutar
migrateContracts();
