/**
 * Script de Migración de Datos - Property Module Upgrade
 *
 * Este script migra las propiedades existentes al nuevo esquema,
 * convirtiendo los campos simples de precio a los nuevos objetos detallados.
 *
 * IMPORTANTE: Ejecutar este script es OPCIONAL. El sistema es compatible
 * con ambos formatos (antiguo y nuevo).
 *
 * USO:
 * node scripts/migrate-properties.js
 */

import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'your-database-name';

async function migrateProperties() {
  console.log('🚀 Iniciando migración de propiedades...');

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB');

    const db = client.db(DB_NAME);
    const propertiesCollection = db.collection('properties');

    // Obtener todas las propiedades que tienen valores simples
    const properties = await propertiesCollection
      .find({
        $or: [
          { valor_venta: { $exists: true, $ne: null } },
          { valor_alquiler: { $exists: true, $ne: null } },
        ],
      })
      .toArray();

    console.log(`📊 Encontradas ${properties.length} propiedades para migrar`);

    let migratedCount = 0;

    for (const property of properties) {
      const updates = {};

      // Migrar valor_venta si existe y no existe valor_venta_detallado
      if (property.valor_venta && !property.valor_venta_detallado) {
        updates.valor_venta_detallado = {
          monto: property.valor_venta,
          moneda: 'ARS', // Asume ARS por defecto, ajustar según tu caso
          es_publico: true,
          descripcion: '',
        };

        // Establecer flag de publicación
        if (!property.hasOwnProperty('publicar_para_venta')) {
          updates.publicar_para_venta = property.valor_venta > 0;
        }
      }

      // Migrar valor_alquiler si existe y no existe valor_alquiler_detallado
      if (property.valor_alquiler && !property.valor_alquiler_detallado) {
        updates.valor_alquiler_detallado = {
          monto: property.valor_alquiler,
          moneda: 'ARS', // Asume ARS por defecto, ajustar según tu caso
          es_publico: true,
          descripcion: '',
        };

        // Establecer flag de publicación
        if (!property.hasOwnProperty('publicar_para_alquiler')) {
          updates.publicar_para_alquiler = property.valor_alquiler > 0;
        }
      }

      // Inicializar arrays vacíos si no existen
      if (!property.imagenes) {
        updates.imagenes = [];
      }

      if (!property.planos) {
        updates.planos = [];
      }

      if (!property.lotes) {
        updates.lotes = [];
      }

      // Actualizar solo si hay cambios
      if (Object.keys(updates).length > 0) {
        await propertiesCollection.updateOne(
          { _id: property._id },
          { $set: updates },
        );
        migratedCount++;

        if (migratedCount % 100 === 0) {
          console.log(`⏳ Migradas ${migratedCount} propiedades...`);
        }
      }
    }

    console.log(`\n✅ Migración completada exitosamente!`);
    console.log(`📈 Total de propiedades migradas: ${migratedCount}`);

    // Crear índices recomendados
    console.log('\n🔧 Creando índices...');

    await propertiesCollection.createIndex({
      'direccion.latitud': 1,
      'direccion.longitud': 1,
    });
    console.log('✅ Índice geoespacial creado');

    await propertiesCollection.createIndex({ publicar_para_venta: 1 });
    console.log('✅ Índice publicar_para_venta creado');

    await propertiesCollection.createIndex({ publicar_para_alquiler: 1 });
    console.log('✅ Índice publicar_para_alquiler creado');

    await propertiesCollection.createIndex({ status: 1 });
    console.log('✅ Índice status creado');

    console.log('\n🎉 ¡Todo listo!');
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    await client.close();
    console.log('👋 Conexión cerrada');
  }
}

// Ejecutar migración
migrateProperties()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
