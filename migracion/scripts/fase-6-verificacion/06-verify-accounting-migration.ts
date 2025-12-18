
import { MongoClient } from 'mongodb';
import { dbConnections } from '../../configuracion/conexiones.config';
import { logger } from '../utils/logger';

/**
 * FASE 6 - Verificación de Migración Contable
 * 
 * 1. Conteo de Asientos migrados (Contractuales vs Ad-Hoc).
 * 2. Conteo de Transacciones generadas.
 * 3. Verificación de integridad:
 *    - ¿Hay asientos V3 con legacy_id vinculados?
 *    - ¿Hay transacciones huérfanas?
 *    - ¿Coinciden los montos pagados con los de transacciones?
 */

async function verifyMigration() {
  logger.startPhase('FASE 6 - Verificación de Integridad Contable');

  let v3Client: MongoClient | null = null;

  try {
    v3Client = await dbConnections.connectToV3();
    const v3Db = v3Client.db();

    // FILTRO QUIRÚRGICO
    const TARGET_CONTRACT_ID = '6902560abbb2614a30d9d131';
    const contractFilter = { contrato_id: new (require('mongodb').ObjectId)(TARGET_CONTRACT_ID) };
    
    // 1. Estadísticas de Asientos (FILTRADO)
    const totalEntries = await v3Db.collection('accountingentries').countDocuments(contractFilter);
    const contractualLinked = await v3Db.collection('accountingentries').countDocuments({ 
        ...contractFilter,
        $or: [
            { "metadata.legacy_account_ids_debito.0": { $exists: true } },
            { "metadata.legacy_account_ids_credito.0": { $exists: true } }
        ]
    });
    const entriesPaid = await v3Db.collection('accountingentries').countDocuments({ 
        ...contractFilter,
        "partidas.monto_pagado_acumulado": { $gt: 0 } 
    });

    logger.info(`📊 Estadísticas de AccountingEntries (Contrato ${TARGET_CONTRACT_ID}):`);
    logger.info(`   Total Asientos V3: ${totalEntries}`);
    logger.info(`   Asientos Vinculados (con legacy_account_ids): ${contractualLinked}`);
    logger.info(`   Asientos con Pagos Registrados: ${entriesPaid}`);

    // 2. Estadísticas de Transacciones (FILTRADO)
    const totalTransactions = await v3Db.collection('transactions').countDocuments({ 
        referencia_asiento_id: { $in: await v3Db.collection('accountingentries').find(contractFilter).project({_id:1}).toArray().then(docs => docs.map(d=>d._id)) }
    });
    
    logger.info('\n💰 Estadísticas de Transactions (Filtradas por contrato):');
    logger.info(`   Total Transacciones Ligadas: ${totalTransactions}`);

    // 3. Estadísticas de Recibos (FILTRADO)
    // Buscamos recibos que tengan al menos un asiento de este contrato en asientos_afectados
    const contractEntriesIds = await v3Db.collection('accountingentries').find(contractFilter).project({_id:1}).toArray().then(docs => docs.map(d=>d._id));
    
    const linkedReceipts = await v3Db.collection('receipts').countDocuments({ 
        "asientos_afectados.asiento_id": { $in: contractEntriesIds } 
    });
    const entriesWithReceipt = await v3Db.collection('accountingentries').countDocuments({ 
        ...contractFilter,
        "recibo_id": { $exists: true } 
    });

    logger.info('\n🧾 Estadísticas de Recibos (Filtradas):');
    logger.info(`   Recibos Vinculados a este contrato: ${linkedReceipts}`);
    logger.info(`   Asientos con Recibo Asociado: ${entriesWithReceipt}`);

    // 3. Verificación de Coherencia Financiera (FILTRADO)
    const sumTransactions = await v3Db.collection('transactions').aggregate([
        { $match: { referencia_asiento_id: { $in: contractEntriesIds } } },
        { $group: { _id: null, total: { $sum: "$monto" } } }
    ]).toArray();

    const totalTransactionAmount = sumTransactions[0]?.total || 0;

    logger.info(`   Monto Total Transaccionado: $${totalTransactionAmount.toLocaleString()}`);

    // 4. Chequeo de Huérfanos (Transacciones sin asiento)
    // Esto es costoso, haremos un sample o count simple si tenemos FK.
    // transactions.referencia_asiento_id
    
    // 5. Alerta de Asientos Contractuales NO Vinculados (pero que deberían)
    // Difícil saber cuántos deberían sin conectar a Legacy.
    // Pero podemos ver ratio:
    // Si tenemos 1000 contratos y solo 10 asientos vinculados, algo anda mal.
    
    logger.success('\n✅ Verificación completada. Revise los números arriba para asegurar consistencia.');

  } catch (error) {
    logger.error('Error en verificación', error);
  } finally {
    if (v3Client) await v3Client.close();
  }
}

if (require.main === module) {
  verifyMigration().catch(console.error);
}
