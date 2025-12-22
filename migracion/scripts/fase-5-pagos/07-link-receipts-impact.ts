
import { MongoClient, ObjectId } from 'mongodb';
import { dbConnections } from '../../configuracion/conexiones.config';
import { logger } from '../utils/logger';

/**
 * FASE 5C - Vinculación de Recibos e Impacto Contable
 * 
 * Objetivo:
 * Enlazar los Recibos V3 (recién migrados por script 01) con los Asientos Contables V3
 * (ya imputados por script 05).
 * 
 * Lógica:
 * 1. Iterar Pagos Legacy (AccountEntries).
 * 2. Obtener `receiptId` y `accountId`.
 * 3. Buscar correspondencias en V3:
 *    - Recibo V3 (por _id preservado).
 *    - Asiento V3 (por _id o metadata).
 * 4. Actualizar V3:
 *    - Recibo: push en `asientos_afectados` { asiento_id, monto }.
 *    - Asiento: set `recibo_id`.
 */

async function linkReceipts() {
  logger.startPhase('FASE 5C - Vinculación de Recibos e Impacto Contable');

  let legacyClient: MongoClient | null = null;
  let v3Client: MongoClient | null = null;

  try {
    legacyClient = await dbConnections.connectToLegacy();
    v3Client = await dbConnections.connectToV3();
    
    const legacyDb = legacyClient.db();
    const v3Db = v3Client.db();

    // 1. Obtener Pagos Legacy que tengan recibo
    logger.info('🔍 Cargando AccountEntries con receiptId...');
    // Proyección para optimizar memoria
    // FILTRO QUIRÚRGICO (COMENTADO - Para migración masiva)
    // const TARGET_CONTRACT_ID = '6902560abbb2614a30d9d131';
    
    // 1. Obtener TODOS los MasterAccounts (migración masiva)
    const masterAccounts = await legacyDb.collection('masteraccounts').find({
        // origin: TARGET_CONTRACT_ID  // Comentado para migración masiva
    }, { projection: { _id: 1 } }).toArray();
    const masterIds = masterAccounts.map(m => m._id);

    // 2. Obtener Accounts de esos Masters
    const accounts = await legacyDb.collection('accounts').find({
        masterAccount: { $in: masterIds }
    }, { projection: { _id: 1 } }).toArray();
    const accountIds = accounts.map(a => a._id);

    // 3. Obtener Entries + Ad-Hoc detectados
    const AD_HOC_ACCOUNT_IDS = [
        "6908a121bbb2614a30d9ef8b", 
        "6904e0cabbb2614a30d9e8b4", 
        "693ab634c791044841ae7d74", 
        "693ad300c791044841ae85ca"
    ].map(id => new ObjectId(id));

    const legacyEntries = await legacyDb.collection('accountentries')
        .find({ 
            receiptId: { $ne: null },
            $or: [
                { accountId: { $in: accountIds } },
                { accountId: { $in: AD_HOC_ACCOUNT_IDS } }
            ]
        })
        .project({ _id: 1, accountId: 1, receiptId: 1, amount: 1, description: 1, agentId: 1 })
        .toArray();

    logger.info(`   Encontrados ${legacyEntries.length} pagos con recibo asociado.`);

    let processed = 0;
    let notFoundAsiento = 0;
    const bulkReceipts: any[] = [];
    const bulkAccounting: any[] = [];

    // Agrupación por recibo para evitar duplicados en bulk
    const receiptUpdates = new Map<string, {
        receiptId: ObjectId,
        asientos: any[]
    }>();

    // Cache para evitar re-lookup de Asientos
    const idsCache = new Map<string, ObjectId>();

    for (const entry of legacyEntries) {
        if (!entry.accountId || !entry.receiptId) continue;
        const legacyAccIdStr = entry.accountId.toString();
        const receiptIdStr = entry.receiptId.toString();
        
        // Resolver Asiento V3
        let v3EntryId: ObjectId | undefined = idsCache.get(legacyAccIdStr);

        if (!v3EntryId) {
            const adHocCandidate = await v3Db.collection('accountingentries').findOne({ _id: entry.accountId }, { projection: { _id: 1 } });
            if (adHocCandidate) {
                v3EntryId = adHocCandidate._id;
            } else {
                let contractualCandidate = await v3Db.collection('accountingentries').findOne({ 
                    $or: [
                        { "metadata.legacy_account_ids_debito": entry.accountId },
                        { "metadata.legacy_account_ids_credito": entry.accountId }
                    ]
                }, { projection: { _id: 1 } });
                if (contractualCandidate) v3EntryId = contractualCandidate._id;
            }
            if (v3EntryId) idsCache.set(legacyAccIdStr, v3EntryId);
        }

        if (!v3EntryId) {
            notFoundAsiento++;
            continue;
        }

        // Agrupar por recibo
        const update = receiptUpdates.get(receiptIdStr) || { 
            receiptId: entry.receiptId, 
            asientos: [] 
        };
        
        // Evitar duplicar el mismo movimiento exacto
        const exists = update.asientos.some((a: any) => a.cuenta_legacy_id.toString() === entry.accountId.toString());
        if (!exists) {
            update.asientos.push({
                asiento_id: v3EntryId,
                monto_imputado: entry.amount,
                tipo_operacion: 'COBRO',
                detalle_legacy: `Pago ${entry._id} - ${entry.description || ''}`,
                cuenta_legacy_id: entry.accountId,
                agente_id: entry.agentId
            });
        }
        receiptUpdates.set(receiptIdStr, update);

        // Referencia inversa en Asiento
        bulkAccounting.push({
            updateOne: {
                filter: { _id: v3EntryId },
                update: { $set: { recibo_id: entry.receiptId } }
            }
        });

        processed++;
    }

    // Preparar bulkReceipts con la agrupación (Limpiando primero si queremos asegurar refresh)
    for (const update of receiptUpdates.values()) {
        bulkReceipts.push({
            updateOne: {
                filter: { _id: update.receiptId },
                update: {
                    $set: { 
                        asientos_afectados: update.asientos
                        // contrato_id removido - no aplica en migración masiva
                    }
                }
            }
        });
    }

    // Ejecutar Bulk Writes
    if (bulkReceipts.length > 0) {
        logger.info(`💾 Actualizando ${bulkReceipts.length} referencias en Recibos...`);
        const resR = await v3Db.collection('receipts').bulkWrite(bulkReceipts);
        logger.success(`✅ Recibos actualizados: ${resR.modifiedCount}`);
    } else {
        logger.warning('⚠️ No se generaron actualizaciones de recibos. ¿Corriste el Script 01?');
    }

    if (bulkAccounting.length > 0) {
        logger.info(`💾 Vinculando ${bulkAccounting.length} recibos en Asientos...`);
        const resA = await v3Db.collection('accountingentries').bulkWrite(bulkAccounting);
        logger.success(`✅ Asientos vinculados: ${resA.modifiedCount}`);
    }

    logger.endPhase('FASE 5C - Completada', { processed, notFoundAsiento });

  } catch (error) {
    logger.error('Error fatal en vinculación de recibos', error);
  } finally {
    if (legacyClient) await legacyClient.close();
    if (v3Client) await v3Client.close();
  }
}

if (require.main === module) {
  linkReceipts().catch(console.error);
}
