import axios from 'axios';
import { MongoClient, ObjectId } from 'mongodb';
import { logger } from '../utils/logger';
import { AUTH_CONFIG } from '../../configuracion/auth.config';

/**
 * FASE 4: Generación de Asientos Contables
 * 
 * Usa el endpoint de migración existente con estrategia FULL_HISTORY
 * para generar asientos mes a mes de todo el historial de contratos.
 */

async function generateAccountingEntries(options: { dryRun?: boolean } = {}) {
  const { dryRun = false } = options;

  logger.startPhase('FASE 4 - Generación de Asientos Contables (FULL_HISTORY)');

  if (dryRun) {
    logger.warning('⚠️  MODO DRY-RUN ACTIVADO');
  }

  let mongoClient: MongoClient | null = null;

  try {
    // 1. Conectar a MongoDB para obtener TODOS los IDs de contratos (FILTRADO)
    logger.info('📊 Conectando a MongoDB para obtener IDs de contratos...');
    mongoClient = await MongoClient.connect('mongodb://127.0.0.1:27017/nest-propietasV3');
    const db = mongoClient.db();
    
    // FILTRO QUIRÚRGICO
    const TARGET_CONTRACT_ID = '6902560abbb2614a30d9d131';
    const query = { _id: new ObjectId(TARGET_CONTRACT_ID) };

    const allContracts = await db.collection('contracts').find(query, { projection: { _id: 1 } }).toArray();
    const contractIds = allContracts.map(c => c._id.toString());
    
    logger.success(`✅ Obtenidos ${contractIds.length} IDs de contratos`);

    // 2. Autenticar con API V3
    logger.info('🔐 Autenticando con API V3...');
    const authResponse = await axios.post(
      `${AUTH_CONFIG.apiBaseUrl}/auth/login`,
      AUTH_CONFIG.credentials,
    );
    const token = authResponse.data.access_token;
    logger.success('✅ Autenticación exitosa');

    // 3. Procesar en lotes de 20 contratos (Reducido para evitar timeouts)
    const BATCH_SIZE = 20;
    const totalBatches = Math.ceil(contractIds.length / BATCH_SIZE);
    
    logger.info(`\n📦 Procesando en ${totalBatches} lotes de ${BATCH_SIZE} contratos`);
    logger.info('   Estrategia: FULL_HISTORY (historial completo mes a mes)');
    logger.info(`   Modo: ${dryRun ? 'DRY-RUN' : 'REAL'}\n`);

    const allResults: any[] = [];
    let totalSuccessful = 0;
    let totalFailed = 0;
    let totalAmount = 0;
    const globalStartTime = Date.now();

    for (let i = 0; i < contractIds.length; i += BATCH_SIZE) {
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const batchIds = contractIds.slice(i, i + BATCH_SIZE);
      
      logger.info(`\n📦 Lote ${batchNumber}/${totalBatches} - Procesando ${batchIds.length} contratos...`);

      const payload = {
        contractIds: batchIds,
        strategy: 'FULL_HISTORY',
        deleteExisting: true, // Ahora true en todos los lotes (cada lote procesa contratos diferentes)
        dryRun,
      };

      try {
        const batchStartTime = Date.now();

        const response = await axios.post(
          `${AUTH_CONFIG.apiBaseUrl}/contracts/migration/generate-accounting-entries`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 600000, // 10 minutos por lote
          },
        );

        const batchTime = Date.now() - batchStartTime;
        const { summary } = response.data;

        // Acumular resultados
        allResults.push(...(summary.results || []));
        totalSuccessful += summary.successCount || 0;
        totalFailed += summary.failureCount || 0;
        totalAmount += summary.totalAmount || 0;

        logger.success(
          `✅ Lote ${batchNumber} completado en ${(batchTime / 1000).toFixed(1)}s - ` +
          `Exitosos: ${summary.successCount}, Fallidos: ${summary.failureCount}, Monto: $${summary.totalAmount.toLocaleString()}`
        );

      } catch (error: any) {
        logger.error(`❌ Error en lote ${batchNumber}:`);
        if (error.response) {
          logger.error(`   Status: ${error.response.status}`);
          logger.error(`   Message: ${error.response.data?.message || error.message}`);
        } else {
          logger.error(`   ${error.message}`);
        }
        
        // Marcar todos los contratos del lote como fallidos
        batchIds.forEach(id => {
          allResults.push({
            success: false,
            contractId: id,
            error: `Lote ${batchNumber} falló: ${error.message}`,
          });
        });
        totalFailed += batchIds.length;
      }

      // Pequeña pausa entre lotes para no saturar el servidor
      if (i + BATCH_SIZE < contractIds.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const executionTime = Date.now() - globalStartTime;

    // 4. Consolidar y mostrar resultados finales
    logger.success('\n✅ Migración completada!');
    logger.info(`⏱️  Tiempo total de ejecución: ${(executionTime / 1000).toFixed(2)}s`);
    logger.info(`⏱️  Tiempo promedio por lote: ${(executionTime / totalBatches / 1000).toFixed(2)}s`);

    logger.info('\n📊 Resumen consolidado:');
    logger.info(`   Contratos procesados: ${contractIds.length}`);
    logger.info(`   Exitosos: ${totalSuccessful}`);
    logger.info(`   Fallidos: ${totalFailed}`);
    logger.info(`   Monto total: $${totalAmount.toLocaleString()}`);

    if (allResults.length > 0) {
      logger.info('\n📋 Primeros resultados:');
      allResults.slice(0, 5).forEach((r: any, idx: number) => {
        if (r.success) {
          logger.success(`   ${idx + 1}. Contrato ${r.contractId}: ${r.asientosGenerados} asientos, $${r.montoTotal?.toLocaleString() || 0}`);
        } else {
          logger.error(`   ${idx + 1}. Contrato ${r.contractId}: ERROR - ${r.error}`);
        }
      });
    }

    // 5. Guardar reporte consolidado
    if (!dryRun) {
      const fs = require('fs');
      const path = require('path');
      const reportDir = path.join(__dirname, '..', '..', 'validacion', 'reports');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      const reportData = {
        timestamp: new Date().toISOString(),
        fase: 'Fase 4 - Generación de Asientos Contables',
        estrategia: 'FULL_HISTORY',
        estadisticas: {
          total_contratos: contractIds.length,
          total_lotes: totalBatches,
          exitosos: totalSuccessful,
          fallidos: totalFailed,
          monto_total: totalAmount,
          tiempo_ejecucion_ms: executionTime,
          tiempo_ejecucion_s: (executionTime / 1000).toFixed(2),
          tiempo_promedio_lote_s: (executionTime / totalBatches / 1000).toFixed(2),
        },
        resultados: allResults,
      };

      const reportPath = path.join(reportDir, `generacion-asientos-full-history-${timestamp}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
      logger.success(`\n📄 Reporte consolidado guardado: ${reportPath}`);
    }

    logger.endPhase('FASE 4 - Generación de Asientos Contables', {
      totalContracts: contractIds.length,
      totalBatches,
      successCount: totalSuccessful,
      failureCount: totalFailed,
      totalAmount,
      executionTime,
    });

    return {
      totalContracts: contractIds.length,
      totalBatches,
      successCount: totalSuccessful,
      failureCount: totalFailed,
      totalAmount,
      results: allResults,
      executionTime,
    };

  } catch (error: any) {
    logger.error('\n❌ Error durante la generación de asientos:');
    if (error.response) {
      logger.error(`   Status: ${error.response.status}`);
      logger.error(`   Message: ${error.response.data?.message || error.message}`);
      logger.error(`   Details: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      logger.error(`   ${error.message}`);
    }
    throw error;
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      logger.info('✅ Conexión MongoDB cerrada');
    }
  }
}

if (require.main === module) {
  const options = {
    dryRun: process.argv.includes('--dry-run'),
  };

  generateAccountingEntries(options)
    .then((summary) => {
      console.log('\n✅ Completado:', summary);
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Error fatal:', error);
      process.exit(1);
    });
}

export { generateAccountingEntries };
