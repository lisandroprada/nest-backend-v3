import mongoose from 'mongoose';

/**
 * Script de Reset: Limpieza Completa de Migración Anterior
 * 
 * Este script elimina todos los datos de la migración anterior de pagos:
 * 1. Elimina todos los Receipts
 * 2. Elimina todas las Transactions
 * 3. Resetea monto_pagado_acumulado y monto_liquidado en AccountingEntries
 * 4. Resetea estados de AccountingEntries a PENDIENTE
 * 5. Resetea secuencia de número de recibo
 * 
 * ADVERTENCIA: Esta operación NO es reversible. Hacer backup antes de ejecutar.
 */

// ===== CONFIGURACIÓN =====
const V3_DB = 'mongodb://127.0.0.1:27017/nest-propietasV3';

interface ResetStats {
  receiptsDeleted: number;
  transactionsDeleted: number;
  accountingEntriesReset: number;
  sequenceReset: boolean;
}

// ===== FUNCIÓN PRINCIPAL =====
async function resetMigration(): Promise<ResetStats> {
  console.log('🔄 Iniciando reset de migración...\n');
  
  const stats: ResetStats = {
    receiptsDeleted: 0,
    transactionsDeleted: 0,
    accountingEntriesReset: 0,
    sequenceReset: false,
  };

  try {
    // Conectar a V3
    await mongoose.connect(V3_DB);
    const db = mongoose.connection.db!;

    console.log('✓ Conectado a V3\n');

    // 1. Eliminar Receipts
    console.log('📋 Eliminando Receipts...');
    const receiptsResult = await db.collection('receipts').deleteMany({});
    stats.receiptsDeleted = receiptsResult.deletedCount || 0;
    console.log(`  ✅ Eliminados: ${stats.receiptsDeleted} receipts\n`);

    // 2. Eliminar Transactions
    console.log('💸 Eliminando Transactions...');
    const transactionsResult = await db.collection('transactions').deleteMany({});
    stats.transactionsDeleted = transactionsResult.deletedCount || 0;
    console.log(`  ✅ Eliminadas: ${stats.transactionsDeleted} transactions\n`);

    // 3. Resetear AccountingEntries
    console.log('📊 Reseteando AccountingEntries...');
    
    // Primero, resetear los campos de pago en las partidas
    const resetResult = await db.collection('accountingentries').updateMany(
      {},
      {
        $set: {
          'partidas.$[].monto_pagado_acumulado': 0,
          'partidas.$[].monto_liquidado': 0,
        },
      }
    );
    
    // Luego, actualizar estados solo de los que tenían pagos
    const estadosResult = await db.collection('accountingentries').updateMany(
      {
        $or: [
          { estado: 'COBRADO' },
          { estado: 'PAGADO' },
          { estado: 'PAGADO_PARCIAL' },
          { estado: 'LIQUIDADO' }
        ]
      },
      {
        $set: {
          estado: 'PENDIENTE',
        },
        $unset: {
          recibo_id: '',
          fecha_pago: '',
          metodo_pago: '',
          fecha_liquidacion: '',
          metodo_liquidacion: '',
          comprobante_liquidacion: ''
        }
      }
    );

    stats.accountingEntriesReset = resetResult.modifiedCount || 0;
    console.log(`  ✅ Partidas reseteadas: ${stats.accountingEntriesReset} asientos`);
    console.log(`  ✅ Estados actualizados: ${estadosResult.modifiedCount || 0} asientos\n`);

    // 4. Resetear secuencia de número de recibo
    console.log('🔢 Reseteando secuencia de recibos...');
    const sequenceResult = await db.collection('sequences').updateOne(
      { _id: 'receipt_number' } as any,
      { $set: { seq: 0 } },
      { upsert: true }
    );

    stats.sequenceReset = true;
    console.log(`  ✅ Secuencia reseteada a 0\n`);

    return stats;

  } catch (error) {
    console.error('\n❌ ERROR durante reset:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// ===== EJECUCIÓN =====
resetMigration()
  .then((stats) => {
    console.log('='.repeat(60));
    console.log('✅ RESET COMPLETADO EXITOSAMENTE');
    console.log('='.repeat(60));
    console.log(`Receipts eliminados:          ${stats.receiptsDeleted}`);
    console.log(`Transactions eliminadas:      ${stats.transactionsDeleted}`);
    console.log(`AccountingEntries reseteados: ${stats.accountingEntriesReset}`);
    console.log(`Secuencia reseteada:          ${stats.sequenceReset ? 'Sí' : 'No'}`);
    console.log('='.repeat(60));
    console.log('\n✨ Base de datos lista para migración limpia\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ ERROR FATAL:', error);
    process.exit(1);
  });
