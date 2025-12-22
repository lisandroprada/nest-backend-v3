/**
 * Simple Property Migration Script
 * Uses native MongoDB driver (no mongoose)
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = 'mongodb://127.0.0.1:27017';
const LEGACY_DB = 'propietas';
const V3_DB = 'nest-propietasV3';

async function migrateProperties() {
  const client = new MongoClient(MONGO_URL);
  
  try {
    console.log('🔄 Conectando a MongoDB...\n');
    await client.connect();
    
    const legacyDb = client.db(LEGACY_DB);
    const v3Db = client.db(V3_DB);
    
    // Obtener propiedades de legacy
    const legacyProperties = await legacyDb.collection('properties').find({}).toArray();
    console.log(`📥 Propiedades en legacy: ${legacyProperties.length}`);
    
    // Verificar propiedades en V3
    const v3Count = await v3Db.collection('properties').countDocuments();
    console.log(`📊 Propiedades en V3: ${v3Count}\n`);
    
    if (v3Count > 0) {
      console.log('⚠️  Ya existen propiedades en V3');
      console.log('💡 Eliminando para re-migrar...');
      await v3Db.collection('properties').deleteMany({});
      console.log('✅ Propiedades eliminadas\n');
    }
    
    console.log('🔄 Migrando propiedades...\n');
    
    let inserted = 0;
    let errors = 0;
    let missingOwners = 0;
    
    for (const prop of legacyProperties) {
      try {
        // Transformación simple manteniendo _id original
        const v3Property = {
          _id: prop._id, // MANTENER ID ORIGINAL
          propietarios_ids: prop.owner?.map(o => o._id) || [],
          identificador_interno: `PROP-${prop._id.toString().slice(-8).toUpperCase()}`,
          titulo: prop.detailedDescription?.title || '',
          descripcion: prop.detailedDescription?.brief || '',
          direccion: {
            calle: prop.address || '',
            numero: '',
            piso_dpto: '',
            codigo_postal: '',
            latitud: prop.lat || null,
            longitud: prop.lng || null,
          },
          caracteristicas: {
            tipo_propiedad: prop.type || 'departamento',
            dormitorios: prop.detailedDescription?.rooms || null,
            banos: prop.detailedDescription?.bathrooms || null,
            metraje_total: prop.detailedDescription?.sqFt || null,
            metraje_cubierto: prop.detailedDescription?.buildSqFt || null,
            antiguedad_anos: prop.detailedDescription?.age || null,
          },
          valor_venta: prop.valueForSale?.amount || null,
          valor_alquiler: prop.valueForRent?.amount || null,
          publicar_para_venta: prop.publishForSale || false,
          publicar_para_alquiler: prop.publishForRent || false,
          status: prop.status || 'DISPONIBLE',
          estado_ocupacional: prop.tenant?._id ? 'ALQUILADA' : 'DISPONIBLE',
          contrato_vigente_id: prop.leaseAgreement || null,
          createdAt: prop.createdAt || new Date(),
          updatedAt: new Date(),
        };
        
        // Verificar propietario existe
        if (v3Property.propietarios_ids.length === 0) {
          missingOwners++;
        }
        
        await v3Db.collection('properties').insertOne(v3Property);
        inserted++;
        
        if (inserted % 100 === 0) {
          console.log(`  Progreso: ${inserted}/${legacyProperties.length}...`);
        }
      } catch (error) {
        errors++;
        if (errors < 5) {
          console.error(`Error con propiedad ${prop._id}:`, error.message);
        }
      }
    }
    
    console.log(`\n✅ Migración completada:`);
    console.log(`   Insertadas: ${inserted}`);
    console.log(`   Errores: ${errors}`);
    console.log(`   Sin propietario: ${missingOwners}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

migrateProperties();
