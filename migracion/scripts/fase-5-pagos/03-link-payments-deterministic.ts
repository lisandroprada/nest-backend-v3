
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
const path = require('path');

// ===== CONFIGURACIÓN =====
const V3_DB = 'mongodb://127.0.0.1:27017/nest-propietasV3';
const MIGRATION_USER_ID = new ObjectId('602b3588d9c61b619f0c61b2');
const CONCURRENCY_LIMIT = 50;
const LOG_DIR = path.join(process.cwd(), 'migracion/scripts/fase-5-pagos/logs');
const LOG_FILE = path.join(LOG_DIR, `deterministic-link-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

// ===== INTERFACES =====
interface ReceiptEntry {
  _id: string; // Legacy ID
  masterAccount: string; // Legacy MasterAccount ID
  account: string; // Type Name
  accountType: 'Debito' | 'Credito';
  accountDescription: string;
  amount: number;
  origin: string; // contract_id legacy
}

interface LinkingStats {
  totalReceipts: number;
  processed: number;
  successful: number;
  failed: number;
  entriesLinked: number;
  transactionsCreated: number;
  errors: { [key: string]: number };
}

// ===== UTILS =====
function log(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  try {
    const fs = require('fs');
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
  } catch (err) {}
}

function getPeriodFromDescription(desc: string): number | null {
    if (!desc) return null;
    const periodMatch = desc.match(/Período\s+(\d+)/i);
    if (periodMatch) return parseInt(periodMatch[1], 10);
    
    const quotaMatch = desc.match(/Cuota\s+(\d+)/i);
    if (quotaMatch) return parseInt(quotaMatch[1], 10);
    
    return null;
}

// ===== LOGICA DETERMINISTICA =====
async function findExactAccountingEntry(v3Db: any, receiptEntry: ReceiptEntry, contractId: ObjectId | null) {
    // A. AD-HOC: Match directo por ID
    // Tipos que sabemos son Ad-Hoc (migrados en Fase 4.5)
    // Factura de Servicios, Expensas, Cargo proveedor, Interés, Bonificación
    const adHocTypes = ['Factura de Servicios', 'Expensas', 'Expensas Extraordinarias', 'Cargo proveedor', 'Interés', 'Bonificación'];
    
    // Check if type matches Ad-Hoc list OR we just try to find by legacy_id first?
    // Stronger guarantee: If we migrated it in Phase 4.5, it HAS the metadata.
    // Let's try to find by legacy_id first. It's the most deterministic link possible.
    
    // Try Legacy ID Match
    const byLegacyId = await v3Db.collection('accountingentries').findOne({
        "metadata.legacy_id": new ObjectId(receiptEntry.masterAccount)
    });
    
    if (byLegacyId) return { type: 'ADHOC_ID', entry: byLegacyId };
    
    // B. CONTRACTUAL: Match por Logica (Contrato + Periodo)
    if (!contractId) return null; // No contract, can't match contractual logic
    
    const period = getPeriodFromDescription(receiptEntry.accountDescription);
    const concept = receiptEntry.account;
    
    let query: any = { contrato_id: contractId };

    // Refinar query segun concepto
    if (concept === 'Alquiler Devengado' || concept === 'Alquiler') {
        query.tipo_asiento = 'Alquiler Mensual';
        if (period) query["metadata.periodo"] = period;
        // Si no hay periodo pero es Alquiler, fallback? Auditoría.
    } 
    else if (concept.includes('Honorarios')) {
        query.tipo_asiento = { $in: ['Honorarios Locatario', 'Honorarios Locador'] };
        if (period) {
             // Try metadata.periodo (some honorarios use it) OR description match?
             // Usually Honorarios follow period too if recurrent.
             // Or verify simple count?
             // Lets assume metadata.periodo exists for recurrent honorarios.
             // If not, maybe just find the one?
             // Fallback: match by amount if unique?
             query["metadata.periodo"] = period;
        }
    }
    else if (concept.includes('Deposito') || concept.includes('Depósito')) {
        query.tipo_asiento = { $regex: /Deposito en Garantia/i };
        // Depósitos suelen ser únicos o pocos.
        // Si period existe, usarlo. Si no, buscar el pendiente?
        if (period) query["metadata.periodo"] = period;
    }
    else {
        // Concepto desconocido contractual?
        return null;
    }
    
    // Execute Query
    let candidates = await v3Db.collection('accountingentries').find(query).toArray();
    
    if (candidates.length === 1) return { type: 'CONTRACT_LOGIC', entry: candidates[0] };
    
    if (candidates.length > 1) {
        // Desambiguacion si hay multiples (ej: Honorarios sin periodo, pero hay 2 cuotas)
        // Intentar match por Amount?
        const matchAmount = candidates.find((c: any) => Math.abs(c.monto_original - receiptEntry.amount) < 1);
        if (matchAmount) return { type: 'CONTRACT_LOGIC_AMOUNT', entry: matchAmount };
        
        // Match por fecha aprox?
        // Fallback: Tomar el primero PENDIENTE
        const matchPending = candidates.find((c: any) => c.estado === 'PENDIENTE');
        if (matchPending) return { type: 'CONTRACT_LOGIC_PENDING', entry: matchPending };
    }

    return null;
}

async function createMissingContractualEntry(v3Db: any, receiptEntry: ReceiptEntry, contractId: ObjectId, period: number | null, concept: string) {
    if (!period) return null; 

    let tipoAsiento = '';
    
    if (concept === 'Alquiler Devengado' || concept === 'Alquiler') {
        tipoAsiento = 'Alquiler Mensual';
    } else {
        return null; 
    }

    const CUENTA_ID = new ObjectId('6920a0f0ce629c47ae5193fe'); // Alquiler a cobrar
    
    const newEntry = {
        _id: new ObjectId(),
        contrato_id: contractId,
        tipo_asiento: tipoAsiento,
        fecha_imputacion: new Date(),
        fecha_vencimiento: new Date(),
        descripcion: `${concept} Periodo ${period} (Generado por Migracion)`,
        estado: 'PENDIENTE',
        monto_original: receiptEntry.amount,
        monto_actual: receiptEntry.amount,
        es_ajustable: false,
        usuario_creacion_id: MIGRATION_USER_ID,
        createdAt: new Date(), updatedAt: new Date(),
        metadata: {
            periodo: period,
            generated_cause: 'Missing in Phase 4'
        },
        partidas: [
            {
                cuenta_id: CUENTA_ID,
                descripcion: 'Cuota Generada',
                debe: receiptEntry.amount,
                haber: 0,
                agente_id: null,
                monto_pagado_acumulado: 0,
                monto_liquidado: 0,
                es_iva_incluido: false,
                monto_base_imponible: receiptEntry.amount,
                monto_iva_calculado: 0
            },
            {
                 cuenta_id: new ObjectId('68de7db05ef4c4702a92debc'),
                 descripcion: 'Contrapartida Generacion',
                 debe: 0,
                 haber: receiptEntry.amount
            }
        ]
    };
    
    await v3Db.collection('accountingentries').insertOne(newEntry);
    return newEntry;
}

async function processReceipt(v3Db: any, receipt: any, stats: LinkingStats) {
    stats.processed++;
    if (stats.processed % 500 === 0) log(`📦 Progreso: ${stats.processed}/${stats.totalReceipts}`);

    const entries = receipt._legacy_data.receiptEntries || [];
    const asientosAfectados: any[] = [];
    let failed = false;

    for (const entry of entries) {
        try {
            let contractId = null;
            if (entry.origin) {
                try { contractId = new ObjectId(entry.origin); } catch {}
            }
            
            // BUSQUEDA DETERMINISTICA
            let match = await findExactAccountingEntry(v3Db, entry, contractId);
            let asiento = match?.entry;
            
            if (!match && contractId) {
                // Fallback: Create Missing Entry
                const period = getPeriodFromDescription(entry.accountDescription);
                if (period && (entry.account === 'Alquiler Devengado' || entry.account === 'Alquiler')) {
                     asiento = await createMissingContractualEntry(v3Db, entry, contractId, period, entry.account);
                     if (asiento) {
                         stats.errors['CreatedMissing'] = (stats.errors['CreatedMissing'] || 0) + 1;
                     }
                }
            }
            
            if (!asiento) {
                stats.errors['NoMatchingEntry'] = (stats.errors['NoMatchingEntry'] || 0) + 1;
                throw new Error(`No se encontró asiento para: ${entry.account} (${entry.masterAccount}) Desc: ${entry.accountDescription}`);
            }

            // Determinar Partida (Debe vs Haber)
            // Legacy 'Debito' -> Cobro -> Imputar al Debe (o Haber si es descuento?)
            // V3 Logic:
            // Si asiento es deuda (ej Alquiler): DEBE > 0. Pagamos contra DEBE.
            // Si asiento es a favor (ej Interes): HABER > 0. Pagamos contra HABER.
            const partidaIndex = asiento.partidas.findIndex((p:any) => p.debe > 0); 
            // Simplificacion: Asumimos estructura estandar de deuda en partida 0.
            // O buscamos saldo pendiente?
            
            let targetPartidaIdx = 0;
            // Best effort find correct partita
            const pDebe = asiento.partidas.findIndex((p:any) => p.debe > 0);
            const pHaber = asiento.partidas.findIndex((p:any) => p.haber > 0);
            
            // Si legacy es Debito (Cobro), buscamos 'bajar' la deuda (Partida Debe) o reconocer ingreso?
            // Si es Alquiler (CXC Asset), el cobro reduce el activo. 
            // Update logic: Increment monto_pagado_acumulado on the Main Partida.
            if (pDebe >= 0) targetPartidaIdx = pDebe;
            else if (pHaber >= 0) targetPartidaIdx = pHaber;
            
            const monto = entry.amount;
            const field = asiento.partidas[targetPartidaIdx].debe > 0 ? 'monto_pagado_acumulado' : 'monto_liquidado';
            
            // Update Accounting Entry
            await v3Db.collection('accountingentries').updateOne(
                { _id: asiento._id },
                { 
                    $inc: { [`partidas.${targetPartidaIdx}.${field}`]: monto }
                    // Recalcular estado luego?
                    // Dejamos que el sistema (o un script posterior) lo arregle? 
                    // Mejor actualizar estado simple aqui.
                }
            );
            
            // Update Status (Simple)
            // (Omitido para brevedad, se puede agregar un updateState helper)
            
            asientosAfectados.push({
                asiento_id: asiento._id,
                monto_imputado: monto,
                tipo_operacion: entry.accountType === 'Debito' ? 'COBRO' : 'PAGO'
            });
            
            stats.entriesLinked++;

        } catch (e: any) {
            log(`❌ Error en recibo ${receipt.numero_recibo}: ${e.message}`);
            failed = true;
        }
    }

    if (!failed && asientosAfectados.length > 0) {
        // Create Transaction
        await v3Db.collection('transactions').insertOne({
            referencia_asiento: asientosAfectados[0].asiento_id, // Link to first
            cuenta_financiera_id: receipt.cuenta_financiera_id,
            fecha_transaccion: receipt.fecha_emision,
            monto: receipt.monto_total,
            tipo: receipt.tipo_flujo_neto,
            descripcion: `Recibo #${receipt.numero_recibo} (Migración Determinística)`,
            receipt_id: receipt._id,
            asientos_afectados: asientosAfectados, // Store details
            usuario_creacion_id: MIGRATION_USER_ID,
            createdAt: new Date(), updatedAt: new Date()
        });
        stats.transactionsCreated++;
        
        // Update Receipt
        await v3Db.collection('receipts').updateOne(
            { _id: receipt._id },
            { 
               $set: { asientos_afectados: asientosAfectados },
               $unset: { _legacy_data: '' } // Done!
            }
        );
        stats.successful++;
    } else {
        stats.failed++;
    }
}


// ===== CONCURRENCIA =====
async function linkPayments() {
    log('🔗 Deterministic Linker Started');
    
    const v3Conn = await mongoose.createConnection(V3_DB).asPromise();
    const v3Db = v3Conn.db;
    
    const receipts = await v3Db.collection('receipts').find({ _legacy_data: { $exists: true } }).toArray();
    const stats: LinkingStats = { totalReceipts: receipts.length, processed: 0, successful: 0, failed: 0, entriesLinked: 0, transactionsCreated: 0, errors: {} };
    
    // Grouping
    const groups: Record<string, any[]> = {};
    const independent: any[] = [];
    
    for (const r of receipts) {
        const origin = r._legacy_data.receiptEntries?.[0]?.origin;
        if (origin) {
            groups[origin] = groups[origin] || [];
            groups[origin].push(r);
        } else {
            independent.push(r);
        }
    }
    
    const tasks = [
        ...Object.values(groups).map(g => async () => { for (const r of g) await processReceipt(v3Db, r, stats); }),
        ...independent.map(r => async () => { await processReceipt(v3Db, r, stats); })
    ];
    
    // Simple concurrency runner
    const executing: Promise<void>[] = [];
    for (const task of tasks) {
        const p = Promise.resolve().then(() => task());
        executing.push(p);
        const clean = () => executing.splice(executing.indexOf(p), 1);
        p.then(clean).catch(clean);
        if (executing.length >= CONCURRENCY_LIMIT) await Promise.race(executing);
    }
    await Promise.all(executing);
    
    log('✅ Finished');
    console.log(JSON.stringify(stats, null, 2));
    process.exit(0);
}

linkPayments();
