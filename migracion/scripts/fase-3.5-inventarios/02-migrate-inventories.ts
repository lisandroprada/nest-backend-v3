import { ObjectId } from 'mongodb';
import { dbConnections } from '../../configuracion/conexiones.config';
import { logger } from '../utils/logger';
import { DbHelpers } from '../utils/db-helpers';

/**
 * FASE 3.5 - PASO 2: Migración de Inventarios Legacy → V3
 * 
 * Crea PropertyInventory + InventoryVersion para cada propiedad con inventario
 * y asocia inventory_version_id a los contratos correspondientes.
 */

interface InventoryMigrationResult {
  total_legacy_properties: number;
  properties_with_inventory: number;
  property_inventories_created: number;
  inventory_versions_created: number;
  total_items_migrated: number;
  contracts_updated: number;
  errors: string[];
}

async function migrateInventories(options: { dryRun?: boolean } = {}) {
  const { dryRun = false } = options;
  
  logger.startPhase('FASE 3.5 - Migración de Inventarios');
  
  if (dryRun) {
    logger.warning('⚠️  MODO DRY-RUN ACTIVADO');
  }

  const result: InventoryMigrationResult = {
    total_legacy_properties: 0,
    properties_with_inventory: 0,
    property_inventories_created: 0,
    inventory_versions_created: 0,
    total_items_migrated: 0,
    contracts_updated: 0,
    errors: [],
  };

  try {
    const legacyDb = await dbConnections.getLegacyDB();
    const v3Db = await dbConnections.getV3DB();

    // 1. Obtener propiedades Legacy con inventario
    logger.info('📖 Obteniendo propiedades con inventario...');
    const legacyProperties = await legacyDb.collection('properties').find({
      inventory: { $exists: true, $ne: null, $not: { $size: 0 } }
    }).toArray();

    result.total_legacy_properties = await legacyDb.collection('properties').countDocuments({});
    result.properties_with_inventory = legacyProperties.length;

    logger.info(`📦 Propiedades con inventario: ${legacyProperties.length}`);

    // 2. Procesar cada propiedad
    for (const legacyProp of legacyProperties) {
      try {
        const propertyId = new ObjectId(legacyProp._id);

        // Verificar que la propiedad exista en V3
        const v3Property = await v3Db.collection('properties').findOne({ _id: propertyId });
        if (!v3Property) {
          result.errors.push(`Property ${propertyId} not found in V3`);
          continue;
        }

        if (!dryRun) {
          // 3. Crear PropertyInventory
          const propertyInventory: any = {
            property_id: propertyId,
            current_version_id: null,
            versions: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const propInvResult = await v3Db.collection('propertyinventories').insertOne(propertyInventory);
          const propertyInventoryId = propInvResult.insertedId;

          // 4. Transformar items Legacy → InventoryItemSnapshot
          const items = (legacyProp.inventory || []).map((item: any) => ({
            nombre: item.item || 'Sin descripción',
            cantidad: item.cantidad || 1,
            ambiente: item.ambiente || 'Sin especificar',
            estado: item.estado || 'Regular',
            observaciones: '',
            fotos_urls: [],
            _id: new ObjectId(),
          }));

          result.total_items_migrated += items.length;

          // 5. Crear InventoryVersion (versión 1 - Inicial Legacy)
          const inventoryVersion = {
            property_inventory_id: propertyInventoryId,
            version_number: 1,
            description: 'Inventario Inicial (migrado desde Legacy)',
            created_at: new Date(),
            created_by: null,
            status: 'ACTIVE',
            items,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const invVersionResult = await v3Db.collection('inventoryversions').insertOne(inventoryVersion);
          const inventoryVersionId = invVersionResult.insertedId;

          // 6. Actualizar PropertyInventory con current_version_id
          await v3Db.collection('propertyinventories').updateOne(
            { _id: propertyInventoryId },
            {
              $set: {
                current_version_id: inventoryVersionId,
                updatedAt: new Date(),
              },
              $push: { versions: inventoryVersionId },
            } as any
          );

          result.property_inventories_created++;
          result.inventory_versions_created++;

          // 7. Asociar inventory_version_id a los contratos de esta propiedad
          const contractsUpdate = await v3Db.collection('contracts').updateMany(
            { propiedad_id: propertyId },
            {
              $set: {
                inventory_version_id: inventoryVersionId,
                inventario_actualizado: true,
                fotos_inventario: ['inventario-legacy-migrado.jpg'],
              },
            }
          );

          result.contracts_updated += contractsUpdate.modifiedCount;

          logger.info(`✅ Migrado inventario de ${legacyProp.address || propertyId} (${items.length} items, ${contractsUpdate.modifiedCount} contratos)`);
        } else {
          const itemCount = legacyProp.inventory?.length || 0;
          logger.info(`[DRY-RUN] Migrar ${legacyProp.address || propertyId}: ${itemCount} items`);
          result.total_items_migrated += itemCount;
        }

      } catch (error: any) {
        const errorMsg = `Property ${legacyProp._id}: ${error.message}`;
        result.errors.push(errorMsg);
        logger.error(errorMsg);
      }
    }

    // 8. Generar reporte
    if (!dryRun) {
      const reportPath = await generateReport(result);
      logger.success(`📄 Reporte guardado: ${reportPath}`);
    }

    logger.endPhase('FASE 3.5 - Migración de Inventarios', result);

    return result;

  } catch (error) {
    logger.error('Error fatal:', error);
    throw error;
  } finally {
    await dbConnections.closeAll();
  }
}

/**
 * Genera reporte JSON con resultados
 */
async function generateReport(result: InventoryMigrationResult): Promise<string> {
  const fs = require('fs');
  const path = require('path');

  const reportDir = path.join(__dirname, '..', '..', 'validacion', 'reports');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const statsReport = {
    timestamp: new Date().toISOString(),
    fase: 'Fase 3.5 - Migración de Inventarios',
    estadisticas: {
      total_propiedades_legacy: result.total_legacy_properties,
      propiedades_con_inventario: result.properties_with_inventory,
      propiedades_sin_inventario: result.total_legacy_properties - result.properties_with_inventory,
      property_inventories_creados: result.property_inventories_created,
      inventory_versions_creados: result.inventory_versions_created,
      total_items_migrados: result.total_items_migrated,
      contratos_actualizados: result.contracts_updated,
      tasa_exito: ((result.property_inventories_created / result.properties_with_inventory) * 100).toFixed(2) + '%',
      errores_count: result.errors.length,
    },
    errores: result.errors,
  };

  const statsPath = path.join(reportDir, `migracion-inventarios-stats-${timestamp}.json`);
  fs.writeFileSync(statsPath, JSON.stringify(statsReport, null, 2));

  return statsPath;
}

if (require.main === module) {
  const options = {
    dryRun: process.argv.includes('--dry-run'),
  };

  migrateInventories(options)
    .then((result) => {
      console.log('\n✅ Completado:', result);
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Error fatal:', error);
      process.exit(1);
    });
}

export { migrateInventories };
