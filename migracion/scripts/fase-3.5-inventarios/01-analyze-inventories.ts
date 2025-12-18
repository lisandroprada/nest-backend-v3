import { ObjectId } from 'mongodb';
import { dbConnections } from '../../configuracion/conexiones.config';
import { logger } from '../utils/logger';

/**
 * FASE 3.5 - PASO 1: Análisis de Inventarios Legacy
 * 
 * Analiza cuántas propiedades tienen inventarios en Legacy
 * y genera estadísticas para la migración.
 */

async function analyzeInventories() {
  logger.startPhase('FASE 3.5 - Análisis de Inventarios');

  try {
    const legacyDb = await dbConnections.getLegacyDB();
    
    // Total de propiedades
    const totalProperties = await legacyDb.collection('properties').countDocuments({});
    logger.info(`📊 Total de propiedades en Legacy: ${totalProperties}`);

    // Propiedades con inventario
    const withInventory = await legacyDb.collection('properties').countDocuments({
      inventory: { $exists: true, $ne: null, $not: { $size: 0 } }
    });
    logger.info(`📦 Propiedades CON inventario: ${withInventory}`);
    logger.info(`❌ Propiedades SIN inventario: ${totalProperties - withInventory}`);

    // Obtener sample de inventarios
    const samples = await legacyDb.collection('properties').find({
      inventory: { $exists: true, $ne: null, $not: { $size: 0 } }
    }).limit(5).toArray();

    logger.info('\n📋 Muestra de inventarios:');
    samples.forEach((prop, idx) => {
      logger.info(`\n  ${idx + 1}. Propiedad: ${prop.address || prop._id}`);
      logger.info(`     Items en inventario: ${prop.inventory?.length || 0}`);
      if (prop.inventory && prop.inventory[0]) {
        logger.info(`     Ejemplo item: ${JSON.stringify(prop.inventory[0], null, 2)}`);
      }
    });

    // Estadísticas de items
    const allWithInventory = await legacyDb.collection('properties').find({
      inventory: { $exists: true, $ne: null, $not: { $size: 0 } }
    }).toArray();

    const totalItems = allWithInventory.reduce((sum, prop) => sum + (prop.inventory?.length || 0), 0);
    const avgItemsPerProperty = (totalItems / withInventory).toFixed(2);

    logger.info(`\n📊 Estadísticas de Items:`);
    logger.info(`   Total de items: ${totalItems}`);
    logger.info(`   Promedio por propiedad: ${avgItemsPerProperty}`);

    // Ambientes únicos
    const ambientes = new Set();
    const estados = new Set();
    
    allWithInventory.forEach(prop => {
      prop.inventory?.forEach((item: any) => {
        if (item.ambiente) ambientes.add(item.ambiente);
        if (item.estado) estados.add(item.estado);
      });
    });

    logger.info(`\n🏠 Ambientes únicos encontrados (${ambientes.size}):`);
    Array.from(ambientes).sort().forEach(a => logger.info(`   - ${a}`));

    logger.info(`\n✅ Estados únicos encontrados (${estados.size}):`);
    Array.from(estados).sort().forEach(e => logger.info(`   - ${e}`));

    logger.endPhase('FASE 3.5 - Análisis de Inventarios', {
      totalProperties,
      withInventory,
      withoutInventory: totalProperties - withInventory,
      totalItems,
      avgItemsPerProperty,
    });

  } catch (error) {
    logger.error('Error en análisis:', error);
    throw error;
  } finally {
    await dbConnections.closeAll();
  }
}

if (require.main === module) {
  analyzeInventories()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Error fatal:', error);
      process.exit(1);
    });
}

export { analyzeInventories };
