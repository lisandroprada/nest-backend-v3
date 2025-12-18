import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
const path = require('path');
const fs = require('fs');

/**
 * FASE 5B - POST-MIGRACIÓN: Reporte de Inconsistencias
 * 
 * Objetivo: Analizar el estado de la base de datos después de la vinculación (Step 02)
 * y generar un reporte detallado de problemas para corrección manual o automática.
 */

// ===== CONFIGURACIÓN =====
const V3_DB = 'mongodb://127.0.0.1:27017/nest-propietasV3';
const REPORT_DIR = path.join(process.cwd(), 'migracion/scripts/fase-5-pagos/reports');
const REPORT_TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const REPORT_JSON = path.join(REPORT_DIR, `inconsistency-report-${REPORT_TIMESTAMP}.json`);
const REPORT_TXT = path.join(REPORT_DIR, `inconsistency-report-${REPORT_TIMESTAMP}.txt`);

// ===== INTERFACES =====

interface InconsistencyStats {
  totalReceipts: number;
  fullyLinked: number;
  partiallyLinked: number;
  notLinked: number;
  
  issues: {
    pendingLegacyData: number; // Tienen _legacy_data
    missingTransactions: number; // Tienen asientos_afectados pero no transaction
    montoMismatch: number; // monto_total != suma(imputaciones)
    orphanReceipts: number; // Sin asientos_afectados ni legacy_data (raro)
    invalidReferences: number; // Referencias a asientos que no existen
  };
}

interface IssueDetail {
  receiptId: ObjectId;
  receiptNumber: number;
  issueType: string;
  description: string;
  details?: any;
}

// ===== FUNCIONES AUXILIARES =====

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ===== FUNCIÓN PRINCIPAL =====

async function generateReport() {
  console.log('📊 Generando Reporte de Inconsistencias Fase 5B...');
  ensureDir(REPORT_DIR);

  let v3Conn: mongoose.Connection;
  const issuesList: IssueDetail[] = [];
  
  const stats: InconsistencyStats = {
    totalReceipts: 0,
    fullyLinked: 0,
    partiallyLinked: 0,
    notLinked: 0,
    issues: {
      pendingLegacyData: 0,
      missingTransactions: 0,
      montoMismatch: 0,
      orphanReceipts: 0,
      invalidReferences: 0
    }
  };

  try {
    v3Conn = await mongoose.createConnection(V3_DB).asPromise();
    const v3Db = v3Conn.db;
    console.log('✅ Conectado a V3\n');

    // 1. Obtener todos los receipts
    const receiptsCursor = v3Db.collection('receipts').find({});
    stats.totalReceipts = await v3Db.collection('receipts').countDocuments();
    
    console.log(`Analizando ${stats.totalReceipts} recibos...`);
    
    let processed = 0;
    
    while (await receiptsCursor.hasNext()) {
      const receipt = await receiptsCursor.next();
      processed++;
      
      if (processed % 5000 === 0) console.log(`  Procesados: ${processed}/${stats.totalReceipts}`);
      
      const hasLegacyData = !!receipt._legacy_data;
      const asientosAfectados = receipt.asientos_afectados || [];
      const hasAsientos = asientosAfectados.length > 0;
      
      // Clasificación básica
      if (!hasLegacyData && hasAsientos) {
        stats.fullyLinked++;
      } else if (hasLegacyData && hasAsientos) {
        stats.partiallyLinked++;
        stats.issues.pendingLegacyData++;
        issuesList.push({
          receiptId: receipt._id,
          receiptNumber: receipt.numero_recibo,
          issueType: 'PARTIAL_LINK',
          description: 'Recibo vinculado parcialmente (conserva _legacy_data)',
          details: { pendingEntries: receipt._legacy_data.receiptEntries?.length }
        });
      } else if (hasLegacyData && !hasAsientos) {
        stats.notLinked++;
        stats.issues.pendingLegacyData++;
        issuesList.push({
          receiptId: receipt._id,
          receiptNumber: receipt.numero_recibo,
          issueType: 'NOT_LINKED',
          description: 'Recibo no vinculado (conserva _legacy_data completo)',
        });
      } else if (!hasLegacyData && !hasAsientos) {
        stats.issues.orphanReceipts++;
        issuesList.push({
          receiptId: receipt._id,
          receiptNumber: receipt.numero_recibo,
          issueType: 'ORPHAN',
          description: 'Recibo sin _legacy_data y sin asientos afectados (Data perdida?)'
        });
      }
      
      // Verificación de inconsistencia de montos
      if (hasAsientos) {
        const totalImputado = asientosAfectados.reduce((sum: number, a: any) => sum + (a.monto_imputado || 0), 0);
        
        // Permitimos una pequeña diferencia por redondeo (0.1) o si es pago parcial
        // Pero si YA NO tiene legacy_data, debería coincidir o ser explicable
        if (!hasLegacyData && Math.abs(receipt.monto_total - totalImputado) > 0.5) {
            // Es aceptable si el recibo era por X y se imputó lo que se pudo?
            // En teoría sí, pero vale la pena reportarlo como advertencia
            stats.issues.montoMismatch++;
            issuesList.push({
              receiptId: receipt._id,
              receiptNumber: receipt.numero_recibo,
              issueType: 'AMOUNT_MISMATCH',
              description: `Monto recibo (${receipt.monto_total}) != Total imputado (${totalImputado.toFixed(2)})`,
              details: { diff: receipt.monto_total - totalImputado }
            });
        }
      }
      
      // Verificación de Transaction faltante
      if (hasAsientos) {
        const transaction = await v3Db.collection('transactions').findOne({ receipt_id: receipt._id });
        if (!transaction) {
          stats.issues.missingTransactions++;
          issuesList.push({
            receiptId: receipt._id,
            receiptNumber: receipt.numero_recibo,
            issueType: 'MISSING_TRANSACTION',
            description: 'Recibo tiene asientos afectados pero no tiene Transaction asociada'
          });
        }
      }
    }
    
    // ===== GENERACIÓN DE ARCHIVOS =====
    
    // 1. JSON Completo
    fs.writeFileSync(REPORT_JSON, JSON.stringify({ stats, issues: issuesList }, null, 2));
    
    // 2. Reporte Ejecutivo TXT
    const reportContent = `
================================================================================
📊 REPORTE DE INCONSISTENCIAS - FASE 5B (Vinculación)
Fecha: ${new Date().toISOString()}
================================================================================

RESUMEN GENERAL:
----------------
Total Recibos V3:      ${stats.totalReceipts}
✅ Vinculados 100%:     ${stats.fullyLinked}
⚠️ Vinculados Parcial:  ${stats.partiallyLinked}
❌ No Vinculados:       ${stats.notLinked}

DETALLE DE PROBLEMAS:
---------------------
1. Pendientes de Vincular (_legacy_data): ${stats.issues.pendingLegacyData}
   (Incluye parciales y no vinculados)

2. Transactions Faltantes:                ${stats.issues.missingTransactions}
   (Recibos con asientos pero sin transaction)

3. Discrepancia de Montos:                ${stats.issues.montoMismatch}
   (Monto Recibo != Suma Imputada)

4. Recibos Huérfanos:                     ${stats.issues.orphanReceipts}
   (Sin data legacy ni asientos - Revisar urgente)

================================================================================
CONCLUSIONES Y ACCIONES:
${getRecommendations(stats)}
================================================================================
    `;
    
    fs.writeFileSync(REPORT_TXT, reportContent.trim());
    
    console.log('\n✅ Reporte generado exitosamente:');
    console.log(`   📄 Resumen: ${REPORT_TXT}`);
    console.log(`   💾 Detalles JSON: ${REPORT_JSON}`);
    
    console.log('\nEstadísticas rápidas:');
    console.log(`  - Pendientes/Parciales: ${stats.issues.pendingLegacyData}`);
    console.log(`  - Transactions faltantes: ${stats.issues.missingTransactions}`);

  } catch (error) {
    console.error('❌ Error generando reporte:', error);
  } finally {
    if (v3Conn) await v3Conn.close();
  }
}

function getRecommendations(stats: InconsistencyStats): string {
  const lines = [];
  
  if (stats.issues.pendingLegacyData > 0) {
    lines.push(`- Hay ${stats.issues.pendingLegacyData} recibos que no se pudieron vincular completamente.`);
    lines.push(`  Posibles causas: Asientos no encontrados, contratos no migrados, o montos ya saldados.`);
  }
  
  if (stats.issues.missingTransactions > 0) {
    lines.push(`- CRÍTICO: ${stats.issues.missingTransactions} recibos tienen asientos pero no transaction.`);
    lines.push(`  Ejecutar script de reparación de transactions.`);
  }
  
  if (stats.issues.orphanReceipts > 0) {
    lines.push(`- CRÍTICO: ${stats.issues.orphanReceipts} recibos huérfanos (sin data). Investigar IDs en JSON.`);
  }
  
  if (lines.length === 0) {
    lines.push('- ✅ Base de datos consistente. No se requieren acciones correctivas mayores.');
  }
  
  return lines.join('\n');
}

// Ejecutar
generateReport();
