import { MongoClient, ObjectId } from 'mongodb';
import { dbConnections } from '../../configuracion/conexiones.config';
const path = require('path');

/**
 * FASE 5A: Migración de Recibos Legacy → V3
 * 
 * Estrategia: Migrar TODOS los recibos legacy como documentos independientes
 * preservando el _id original, SIN vincular a asientos contables (eso será Fase 5B).
 * 
 * Total estimado: ~25,913 recibos
 */



// Usuario de migración (para auditoría)
const MIGRATION_USER_ID = new ObjectId('602b3588d9c61b619f0c61b2');

// Cuenta financiera por defecto (se obtiene en runtime)
let DEFAULT_FINANCIAL_ACCOUNT_ID: ObjectId;

// Logs
const LOG_DIR = path.join(process.cwd(), 'migracion/scripts/fase-5-pagos/logs');
const LOG_FILE = path.join(LOG_DIR, `migrate-receipts-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

// ===== INTERFACES =====

interface LegacyReceipt {
  _id: ObjectId;
  date: Date;
  amount: number;
  agentId: ObjectId;
  agentFullName: string;
  type: string;
  invoiced?: boolean;
  billable?: boolean;
  receiptEntries: Array<{
    _id: string;
    masterAccount: string;
    account: string;
    accountType: 'Debito' | 'Credito';
    accountDescription?: string;
    amount: number;
    origin: string; // contract_id
    feeComponent?: number;
  }>;
  paymentMethod?: {
    paymentMethod: string;
    cbu?: string;
    checkBank?: string;
    checkNumber?: string;
  };
}

interface MigrationStats {
  totalLegacyReceipts: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  
  errors: {
    invalidData: number;
    duplicates: number;
    other: number;
  };
}

// ===== FUNCIONES AUXILIARES =====

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  try {
    const fs = require('fs');
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  } catch (err) {
    // Silently fail if can't write to file
  }
}

function mapPaymentMethod(legacyMethod?: string): string {
  if (!legacyMethod) return 'efectivo';
  
  const mapping: Record<string, string> = {
    'cash': 'efectivo',
    'transfer': 'transferencia',
    'check': 'cheque',
    'debit': 'tarjeta_debito',
    'credit': 'tarjeta_credito',
    'actualizacion': 'ajuste',
    'mercadopago': 'mercadopago',
    'bank_transfer': 'transferencia'
  };
  
  return mapping[legacyMethod.toLowerCase()] || 'efectivo';
}

async function getNextReceiptNumber(db: any): Promise<number> {
  const result = await db.collection('sequences').findOneAndUpdate(
    { _id: 'receipt_number' } as any,
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return result.seq || result.value?.seq || 1;
}

// ===== FUNCIÓN PRINCIPAL =====

async function migrateReceipts(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalLegacyReceipts: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: {
      invalidData: 0,
      duplicates: 0,
      other: 0
    }
  };

  let legacyClient: MongoClient | null = null;
  let v3Client: MongoClient | null = null;

  try {
    // Conectar a ambas bases de datos
    log('🔗 Conectando a bases de datos...');
    legacyClient = await dbConnections.connectToLegacy();
    v3Client = await dbConnections.connectToV3();
    
    const legacyDb = legacyClient.db();
    const v3Db = v3Client.db();
    
    log('✅ Conectado a Legacy y V3\n');

    // Obtener cuenta financiera por defecto
    const defaultAccount = await v3Db.collection('financialaccounts').findOne({ status: 'ACTIVA' });
    if (!defaultAccount) {
      throw new Error('No se encontró ninguna cuenta financiera activa en V3');
    }
    DEFAULT_FINANCIAL_ACCOUNT_ID = defaultAccount._id;
    log(`💰 Cuenta financiera por defecto: ${defaultAccount.nombre} (${DEFAULT_FINANCIAL_ACCOUNT_ID})\n`);

    // FILTRO QUIRÚRGICO (COMENTADO - Para migración masiva)
    // const TARGET_CONTRACT_ID = '6902560abbb2614a30d9d131';
    log(`🔍 Buscando todos los recibos...`);
    
    // Migración masiva: obtener TODOS los recibos con receiptId
    const entries = await legacyDb.collection('accountentries').find({
        receiptId: { $ne: null }
    }, { projection: { receiptId: 1 } }).toArray();
    
    const receiptIds = [...new Set(entries.map(e => e.receiptId))];
    log(`   Encontrados ${receiptIds.length} IDs de recibos únicos en total.`);

    // Obtener total de recibos filtrados
    stats.totalLegacyReceipts = receiptIds.length;
    log(`📋 Total de recibos legacy a migrar (quirúrgico): ${stats.totalLegacyReceipts}\n`);

    // Procesar en lotes
    const BATCH_SIZE = 1000;
    let skipCount = 0;
    
    while (skipCount < stats.totalLegacyReceipts) {
      const currentBatchIds = receiptIds.slice(skipCount, skipCount + BATCH_SIZE);
      const batch = await legacyDb
        .collection('receipts')
        .find({ _id: { $in: currentBatchIds } })
        .toArray() as unknown as LegacyReceipt[];
      
      log(`\n📦 Procesando lote ${Math.floor(skipCount / BATCH_SIZE) + 1} (${skipCount + 1} - ${Math.min(skipCount + BATCH_SIZE, stats.totalLegacyReceipts)})`);
      
      for (const legacyReceipt of batch) {
        stats.processed++;
        
        try {
          // Validar datos básicos
          if (!legacyReceipt._id || !legacyReceipt.agentId || !legacyReceipt.date) {
            log(`  ⚠️  Recibo ${legacyReceipt._id} tiene datos inválidos - SKIP`);
            stats.skipped++;
            stats.errors.invalidData++;
            continue;
          }

          // [ELIMINADO: chequeo de existingReceipt para permitir re-runs en modo ejecución]

          // Obtener siguiente número de recibo
          const numeroRecibo = await getNextReceiptNumber(v3Db);
          
          // Determinar tipo de flujo (mayoría son INGRESO, pero hay EGRESO para pagos a propietarios)
          const tipoFlujo = legacyReceipt.amount < 0 ? 'INGRESO' : 'EGRESO';
          
          // Mapear método de pago
          const metodoPago = mapPaymentMethod(legacyReceipt.paymentMethod?.paymentMethod);
          
          // Crear documento Receipt V3
          const v3Receipt = {
            _id: legacyReceipt._id, // PRESERVAR _id original
            numero_recibo: numeroRecibo,
            fecha_emision: legacyReceipt.date,
            monto_total: Math.abs(legacyReceipt.amount),
            metodo_pago: metodoPago,
            comprobante_externo: legacyReceipt.paymentMethod?.checkNumber || legacyReceipt.paymentMethod?.cbu,
            cuenta_financiera_id: DEFAULT_FINANCIAL_ACCOUNT_ID,
            agente_id: legacyReceipt.agentId,
            asientos_afectados: [], // Vacío - se llenará en Fase 5B
            usuario_emisor_id: MIGRATION_USER_ID,
            observaciones: `Migrado desde legacy (Fase 5A). ${legacyReceipt.receiptEntries?.length || 0} entries pendientes de vinculación en Fase 5B`,
            tipo_flujo_neto: tipoFlujo,
            
            // Metadata temporal para Fase 5B
            _legacy_data: {
              agentFullName: legacyReceipt.agentFullName,
              type: legacyReceipt.type,
              invoiced: legacyReceipt.invoiced || false,
              billable: legacyReceipt.billable || false,
              receiptEntries: (legacyReceipt.receiptEntries || []).map(entry => ({
                _id: entry._id,
                masterAccount: entry.masterAccount,
                account: entry.account,
                accountType: entry.accountType,
                accountDescription: entry.accountDescription,
                amount: entry.amount,
                origin: entry.origin,
                feeComponent: entry.feeComponent
              }))
            }
          };
          
          // Insertar en V3 (Upsert para permitir re-ejecución)
          await v3Db.collection('receipts').updateOne(
            { _id: v3Receipt._id } as any,
            { $set: v3Receipt },
            { upsert: true }
          );
          stats.successful++;
          
          // Log progreso cada 10 recibos (ahora que son poquitos)
          if (stats.successful % 10 === 0) {
            log(`  ✅ Migrados: ${stats.successful}/${stats.totalLegacyReceipts}`);
          }

        } catch (error: any) {
          stats.failed++;
          stats.errors.other++;
          log(`  ❌ Error en recibo ${legacyReceipt._id}: ${error.message}`);
        }
      }
      
      skipCount += BATCH_SIZE;
    }

    return stats;

  } catch (error) {
    log(`\n❌ ERROR FATAL: ${error}`);
    throw error;
  } finally {
    if (legacyClient) await legacyClient.close();
    if (v3Client) await v3Client.close();
  }
}

// ===== EJECUCIÓN =====

migrateReceipts()
  .then((stats) => {
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN DE MIGRACIÓN - FASE 5A');
    console.log('='.repeat(80));
    console.log(`Total recibos legacy:       ${stats.totalLegacyReceipts}`);
    console.log(`Procesados:                 ${stats.processed}`);
    console.log(`Exitosos:                   ${stats.successful}`);
    console.log(`Fallidos:                   ${stats.failed}`);
    console.log(`Omitidos:                   ${stats.skipped}`);
    console.log('');
    console.log('ERRORES:');
    console.log(`  Datos inválidos:          ${stats.errors.invalidData}`);
    console.log(`  Duplicados:               ${stats.errors.duplicates}`);
    console.log(`  Otros errores:            ${stats.errors.other}`);
    console.log('='.repeat(80));
    console.log(`\n📝 Log guardado en: ${LOG_FILE}`);
    console.log('\n✅ FASE 5A COMPLETADA');
    console.log('   Todos los recibos tienen:');
    console.log('   - _id preservado del legacy');
    console.log('   - asientos_afectados vacío');
    console.log('   - _legacy_data con receiptEntries');
    console.log('\n📌 PRÓXIMOS PASOS:');
    console.log('   1. Migrar contratos (Fase 3)');
    console.log('   2. Generar asientos contables (Fase 4)');
    console.log('   3. Ejecutar Fase 5B para vincular entries\n');
    
    process.exit(stats.failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('\n❌ ERROR FATAL:', error);
    process.exit(1);
  });
