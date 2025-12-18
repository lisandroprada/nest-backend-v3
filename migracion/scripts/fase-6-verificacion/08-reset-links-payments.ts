
import { MongoClient } from 'mongodb';
import { dbConnections } from '../../configuracion/conexiones.config';
import { logger } from '../utils/logger';

/**
 * FASE 6 - RESET GLOBAL DE PAGOS Y VINCULACIONES
 * 
 * Objetivo: Limpiar toda la data de pagos y vinculaciones legacy para poder re-ejecutar
 * la migración con la lógica corregida (Scripts 04, 05, 07).
 * 
 * Acciones:
 * 1. Eliminar Transacciones generadas por migración (REF: LEGACY_PAYMENT_xxx).
 * 2. Resetear AccountingEntries:
 *    - Vaciar `metadata.legacy_account_ids`
 *    - Resetear `monto_pagado_acumulado` a 0.
 *    - Resetear `estado` a PENDIENTE (excepto si ya estaba pagado por otras razones, pero en fresh migration asumimos todo pendiente).
 * 3. Vaciar `asientos_afectados` en Receipt (Fase 5C).
 */

async function resetGlobalMigration() {
  logger.startPhase('FASE 6 - RESET GLOBAL DE MIGRACIÓN CONTABLE');

  let v3Client: MongoClient | null = null;

  try {
    v3Client = await dbConnections.connectToV3();
    const v3Db = v3Client.db();
    
    // 1. ELIMINAR TRANSACCIONES
    logger.info('🗑️  Eliminando Transacciones migradas (LEGACY_PAYMENT_)...');
    const deleteTxsParams = { referencia_externa: /LEGACY/ };
    const txsCount = await v3Db.collection('transactions').countDocuments(deleteTxsParams);
    if(txsCount > 0) {
        await v3Db.collection('transactions').deleteMany(deleteTxsParams);
        logger.success(`   Eliminadas ${txsCount} transacciones.`);
    } else {
        logger.info('   No se encontraron transacciones legacy para borrar.');
    }

    // 2. RESETEAR ACCOUNTING ENTRIES (Pagos y Links)
    logger.info('🔄 Reseteando Accounting Entries (Saldos y Vinculaciones)...');
    
    // Solo tocamos los que fueron tocados por la migración (tienen legacy account ids o pagos legacy)
    // Pero mejor prevenir y resetear todos los contractuales generados.
    // La forma segura es: buscar los que tienen legacy_account_ids (que agregamos en script 04)
    // OJO: Si reseteamos legacy_account_ids, perdemos la info para re-vincular? No, script 04 la regenera.
    // Script 03 (Ad Hoc) preserva _id, esos NO los tocamos en metadata, PERO SÍ en pagos.
    // Los asientos Ad-Hoc tienen metadata.legacy_id, NO legacy_account_ids (array).
    // Script 04 usa legacy_account_ids.
    
    // A. Resetear Asientos Contractuales (Vinculados)
    // Quitamos los links (ahora hay 2 tipos) y reseteamos saldo.
    const resContractual = await v3Db.collection('accountingentries').updateMany(
        { 
            $or: [
                { "metadata.legacy_account_ids_debito": { $exists: true, $not: { $size: 0 } } },
                { "metadata.legacy_account_ids_credito": { $exists: true, $not: { $size: 0 } } },
                { "metadata.legacy_account_ids": { $exists: true, $not: { $size: 0 } } } // Legacy field
            ]
        },
        { 
            $set: { 
                "metadata.legacy_account_ids": [],
                "metadata.legacy_account_ids_debito": [],
                "metadata.legacy_account_ids_credito": [],
                "partidas.$[].monto_pagado_acumulado": 0,
                estado: "PENDIENTE",
                recibo_id: null
            }
        }
    );
    logger.info(`   Reseteados (Links & Saldo) Contractuales: ${resContractual.modifiedCount}`);

    // B. Resetear Asientos Ad-Hoc (Preservados)
    // Estos no tienen legacy_account_ids en array (script 03 usa legacy_id en root metadata).
    // Solo reseteamos su saldo pagado, ya que el link es estructural.
    const resAdHoc = await v3Db.collection('accountingentries').updateMany(
        { "metadata.legacy_id": { $exists: true } }, 
        { 
            $set: { 
                "partidas.$[].monto_pagado_acumulado": 0,
                estado: "PENDIENTE",
                recibo_id: null
            }
        }
    );
    logger.info(`   Reseteados (Saldo) Ad-Hoc: ${resAdHoc.modifiedCount}`);

    // 3. RESETEAR RECIBOS (Fase 5C)
    logger.info('🧾 Limpiando vinculaciones en Recibos...');
    const resReceipts = await v3Db.collection('receipts').updateMany(
        { "asientos_afectados.0": { $exists: true } },
        { $set: { asientos_afectados: [] } }
    );
    logger.info(`   Recibos limpiados: ${resReceipts.modifiedCount}`);

    logger.success('✅ RESET GLOBAL COMPLETADO. Listo para re-ejecutar Scripts 04, 05, 07.');

  } catch (error) {
    logger.error('Error fatal en reset', error);
  } finally {
    if (v3Client) await v3Client.close();
  }
}

if (require.main === module) {
  resetGlobalMigration().catch(console.error);
}
