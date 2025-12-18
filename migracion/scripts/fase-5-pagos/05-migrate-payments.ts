
import { MongoClient, ObjectId } from 'mongodb';
import { dbConnections } from '../../configuracion/conexiones.config';
import { logger } from '../utils/logger';
import { DbHelpers } from '../utils/db-helpers';

/**
 * FASE 5B - Migración de Pagos (Legacy AccountEntry -> V3)
 * 
 * Estrategia: "Imputación Directa por ID"
 * 
 * 1. Lee 'AccountEntry' de Legacy (los pagos).
 * 2. Busca el 'AccountingEntry' V3 destino:
 *    - Intento A: findById(accountId) -> Para Ad-Hoc (IDs preservados).
 *    - Intento B: find({ "metadata.legacy_account_ids": accountId }) -> Para Contractuales (Vinculados).
 * 3. Registra el PAGO:
 *    - Actualiza monto_pagado_acumulado.
 *    - Actualiza estado (PAGADO/PAGADO_PARCIAL).
 *    - Inserta historial_cambios.
 * 4. Crea Transaction Financiera (Movimiento de Caja).
 */

async function migratePayments() {
  logger.startPhase('FASE 5B - Migración de Pagos (AccountEntries)');

  let legacyClient: MongoClient | null = null;
  let v3Client: MongoClient | null = null;

  try {
    legacyClient = await dbConnections.connectToLegacy();
    v3Client = await dbConnections.connectToV3();
    
    const legacyDb = legacyClient.db();
    const v3Db = v3Client.db();

    // 1. Obtener Pagos Legacy (AccountEntry)
    // Filtramos solo los que son pagos (type 'Debito' suele ser el cobro al inquilino, que es lo que reduce la deuda).
    // OJO: En Legacy, AccountEntry type debe coincidir con el Account type.
    // Si la Account es 'Debito' (Deuda Inquilino), el Entry que la baja es un Pago.
    
    logger.info('🔍 Cargando AccountEntries (Pagos) de Legacy...');
    
    // FILTRO QUIRÚRGICO
    const TARGET_CONTRACT_ID = '6902560abbb2614a30d9d131';
    
    // 1. Obtener MasterAccounts del contrato
    const masterAccounts = await legacyDb.collection('masteraccounts').find({
        origin: TARGET_CONTRACT_ID
    }, { projection: { _id: 1 } }).toArray();
    const masterIds = masterAccounts.map(m => m._id);

    // 2. Obtener Accounts de esos Masters
    const accounts = await legacyDb.collection('accounts').find({
        masterAccount: { $in: masterIds }
    }, { projection: { _id: 1 } }).toArray();
    const accountIds = accounts.map(a => a._id);

    // 3. Obtener Entries de esas Accounts + Ad-Hoc detectados
    const AD_HOC_ACCOUNT_IDS = [
        "6908a121bbb2614a30d9ef8b", 
        "6904e0cabbb2614a30d9e8b4", 
        "693ab634c791044841ae7d74", 
        "693ad300c791044841ae85ca"
    ].map(id => new ObjectId(id));

    const legacyEntries = await legacyDb.collection('accountentries').find({
        $or: [
            { accountId: { $in: accountIds } },
            { accountId: { $in: AD_HOC_ACCOUNT_IDS } }
        ]
    }).toArray();

    logger.info(`   Encontrados ${legacyEntries.length} movimientos para contrato ${TARGET_CONTRACT_ID}.`);

    // Obtener Receipts para info de caja (opcional, por ahora usaremos info del entry o default)
    // const receipts = await legacyDb.collection('receipts').find({}).toArray();
    // const receiptMap = new Map(receipts.map(r => [r._id.toString(), r]));

    // Buscar Caja Default en V3 para transacciones
    const defaultAccount = await v3Db.collection('financial_accounts').findOne({ nombre: /Efectivo|Caja/i });
    const defaultAccountId = defaultAccount ? defaultAccount._id : new ObjectId();
    if (!defaultAccount) logger.warning('⚠️  No se encontró Caja default. Se usará ID generado.');

    let processedCount = 0;
    let notFoundCount = 0;
    let skippedCount = 0;
    const transactionsToInsert: any[] = [];

    // Cache simple: ID_Legacy -> { v3EntryId, isDebitoPayment }
    const idsCache = new Map<string, { v3EntryId: ObjectId, isDebito: boolean }>();

    // Agrupación local para evitar colisiones en bulkWrite
    // Llave: v3EntryId_agentId_tipo(debe/haber)
    const consolidationMap = new Map<string, { 
        v3EntryId: ObjectId, 
        agentId: any, 
        amount: number, 
        isDebito: boolean, 
        history: any[] 
    }>();

    for (const entry of legacyEntries) {
        if (!entry.accountId) continue;
        const legacyAccIdStr = entry.accountId.toString();
        
        const cached = idsCache.get(legacyAccIdStr);
        let v3EntryId: ObjectId | undefined = cached?.v3EntryId;
        let isDebitoPayment = cached?.isDebito ?? false;

        if (!v3EntryId) {
            // Intento A: Ad-Hoc
            const adHocCandidate = await v3Db.collection('accountingentries').findOne({ _id: entry.accountId });
            if (adHocCandidate) {
                v3EntryId = adHocCandidate._id;
                isDebitoPayment = true;
            } else {
                // Intento B: Contractual
                let contractualCandidate = await v3Db.collection('accountingentries').findOne({ 
                    $or: [
                        { "metadata.legacy_account_ids_debito": entry.accountId },
                        { "metadata.legacy_account_ids_credito": entry.accountId }
                    ]
                });
                
                if (contractualCandidate) {
                    v3EntryId = contractualCandidate._id;
                    const isDebitoLinked = (contractualCandidate.metadata.legacy_account_ids_debito || [])
                        .some((id: any) => id.toString() === legacyAccIdStr);
                    isDebitoPayment = isDebitoLinked;
                }
            }
            if (v3EntryId) idsCache.set(legacyAccIdStr, { v3EntryId, isDebito: isDebitoPayment });
        }

        if (!v3EntryId) {
            notFoundCount++;
            continue;
        }

        const amount = entry.amount;
        const entryAgentId = entry.agentId; 
        if (!amount || amount <= 0 || !entryAgentId) {
            skippedCount++;
            continue;
        }

        // Consolidador (Asegurar ObjectId para evitar problemas de comparación)
        const v3Id = new ObjectId(v3EntryId.toString());
        const agentId = new ObjectId(entryAgentId.toString());
        const key = `${v3Id}_${agentId}_${isDebitoPayment ? 'D' : 'H'}`;
        
        const existing = consolidationMap.get(key) || { 
            v3EntryId: v3Id, 
            agentId: agentId, 
            amount: 0, 
            isDebito: isDebitoPayment,
            history: [] 
        };
        
        existing.amount += amount;
        console.log(`🧪 Agregando pago: ${amount} (Total acumulado para ${key}: ${existing.amount})`);
        existing.history.push({
            fecha: entry.date || new Date(),
            usuario_id: null,
            accion: 'PAGO_MIGRADO',
            monto: amount,
            estado_anterior: 'PENDIENTE',
            estado_nuevo: 'PAGADO',
            observaciones: `Pago Legacy ${entry._id} (Recibo ${entry.receiptId}) - ${entry.description}`
        });
        consolidationMap.set(key, existing);

        // Transaction V3 (Campos Corregidos según Entity)
        transactionsToInsert.push({
            referencia_asiento: v3EntryId,
            cuenta_financiera_id: defaultAccountId,
            fecha_transaccion: entry.date || new Date(),
            monto: amount,
            tipo: 'INGRESO', // Mapeado a INGRESO/EGRESO de la entidad
            descripcion: `Legacy - ${entry.description}`,
            referencia_externa: `LEGACY_ENTRY_${entry._id}`,
            receipt_id: entry.receiptId,
            conciliado: true,
            fecha_conciliacion: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        });

        processedCount++;
    }

    // Ejecutar Imputaciones Consolidadas
    if (consolidationMap.size > 0) {
        logger.info(`💾 Imputando ${consolidationMap.size} partidas en Asientos V3 (Consolidación activada)...`);
        const bulkOps: any[] = [];
        
        for (const data of consolidationMap.values()) {
            const partidaFilter = data.isDebito
                ? { "elem.debe": { $gt: 0 }, "elem.agente_id": data.agentId }
                : { "elem.haber": { $gt: 0 }, "elem.agente_id": data.agentId };

            const updateField = data.isDebito 
                ? "partidas.$[elem].monto_pagado_acumulado" 
                : "partidas.$[elem].monto_liquidado";

            bulkOps.push({
                updateOne: {
                    filter: { _id: data.v3EntryId },
                    update: {
                        $inc: { [updateField]: data.amount },
                        $push: { historial_cambios: { $each: data.history } }
                    },
                    arrayFilters: [partidaFilter]
                }
            });
        }
        
        const resEntries = await v3Db.collection('accountingentries').bulkWrite(bulkOps);
        logger.success(`✅ Partidas actualizadas: ${resEntries.modifiedCount}`);

        // NUEVO: Finalizar estados (PAGADO / COBRADO / LIQUIDADO)
        logger.info('🔄 Finalizando estados de asientos...');
        const affectedEntryIds = Array.from(new Set(Array.from(consolidationMap.values()).map(d => d.v3EntryId)));
        
        const finalEntries = await v3Db.collection('accountingentries').find({ _id: { $in: affectedEntryIds } }).toArray();
        const bulkStatus: any[] = [];
        
        for (const entry of finalEntries) {
            const totalDebe = entry.partidas.reduce((sum: number, p: any) => sum + (p.debe || 0), 0);
            const totalPagadoDebe = entry.partidas.reduce((sum: number, p: any) => sum + (p.monto_pagado_acumulado || 0), 0);
            
            const totalHaberAgentes = entry.partidas.reduce((sum: number, p: any) => sum + (p.agente_id ? (p.haber || 0) : 0), 0);
            const totalLiquidadoHaber = entry.partidas.reduce((sum: number, p: any) => sum + (p.agente_id ? (p.monto_liquidado || 0) : 0), 0);

            let nuevoEstado = 'PENDIENTE';
            
            const estaCobrado = totalPagadoDebe >= totalDebe && totalDebe > 0;
            const estaLiquidado = totalHaberAgentes > 0 ? (totalLiquidadoHaber >= totalHaberAgentes) : true;

            if (estaCobrado && estaLiquidado) {
                nuevoEstado = 'LIQUIDADO';
            } else if (estaCobrado) {
                nuevoEstado = 'COBRADO';
            } else if (totalPagadoDebe > 0) {
                nuevoEstado = 'PAGADO_PARCIAL';
            }
            
            if (nuevoEstado !== entry.estado) {
                bulkStatus.push({
                    updateOne: {
                        filter: { _id: entry._id },
                        update: { $set: { estado: nuevoEstado } }
                    }
                });
            }
        }
        
        if (bulkStatus.length > 0) {
            await v3Db.collection('accountingentries').bulkWrite(bulkStatus);
            logger.success(`✅ Estados de asientos actualizados: ${bulkStatus.length}`);
        }
    }

    if (transactionsToInsert.length > 0) {
        logger.info(`💾 Generando ${transactionsToInsert.length} Transacciones Financieras...`);
        const resTrans = await v3Db.collection('transactions').insertMany(transactionsToInsert);
        logger.success(`✅ Transacciones creadas: ${resTrans.insertedCount}`);
    }

    logger.endPhase('FASE 5B - Completada', { processed: processedCount, notFound: notFoundCount, skipped: skippedCount });

  } catch (error) {
    logger.error('Error fatal en migración Pagos', error);
  } finally {
    if (legacyClient) await legacyClient.close();
    if (v3Client) await v3Client.close();
  }
}

if (require.main === module) {
  migratePayments().catch(console.error);
}
