import { dbConnections, DB_CONFIG } from '../../configuracion/conexiones.config';
import { logger } from '../utils/logger';
import { DbHelpers } from '../utils/db-helpers';
import { ValidationReport } from '../utils/validators';

/**
 * FASE 1 - PASO 3: Validación Post-Migración de Agentes
 * 
 * Este script valida que la migración de agentes se haya realizado correctamente.
 * 
 * Validaciones:
 * - Verificar que todos los _id de Legacy existan en V3
 * - Comparar conteos totales
 * - Verificar integridad de campos críticos
 * - Validar índices únicos (email)
 */

async function validateAgentsMigration() {
  logger.startPhase('FASE 1.3 - Validación Post-Migración de Agentes');

  try {
    // Conectar a ambas bases de datos
    const legacyDb = await dbConnections.getLegacyDB();
    const v3Db = await dbConnections.getV3DB();

    const legacyCollection = legacyDb.collection(DB_CONFIG.legacy.collections.agents);
    const v3Collection = v3Db.collection(DB_CONFIG.v3.collections.agents);

    const report = new ValidationReport();

    // 1. Comparar conteos totales
    logger.info('🔍 Comparando conteos...');
    const comparison = await DbHelpers.compareCollectionCounts(
      DB_CONFIG.legacy.collections.agents,
      DB_CONFIG.v3.collections.agents,
    );

    if (!comparison.match) {
      report.addError(
        'Migration',
        'count',
        'total',
        `Diferencia en conteos: Legacy ${comparison.legacy}, V3 ${comparison.v3}`,
      );
    }

    // 2. Verificar que todos los _id de Legacy existan en V3
    logger.info('🔍 Verificando existencia de todos los _id...');
    const legacyAgents = await legacyCollection.find({}).project({ _id: 1 }).toArray();
    
    let missingCount = 0;
    for (const legacyAgent of legacyAgents) {
      const exists = await DbHelpers.documentExists(v3Db, DB_CONFIG.v3.collections.agents, legacyAgent._id);
      if (!exists) {
        missingCount++;
        report.addError('Agent', legacyAgent._id, '_id', 'Agente no encontrado en V3');
      }
    }

    if (missingCount === 0) {
      logger.success('✅ Todos los agentes de Legacy existen en V3');
    } else {
      logger.error(`❌ Faltan ${missingCount} agentes en V3`);
    }

    // 3. Verificar integridad de datos en muestra aleatoria
    logger.info('🔍 Verificando integridad de datos (muestra aleatoria de 10 agentes)...');
    const sampleAgents = await legacyCollection.aggregate([{ $sample: { size: 10 } }]).toArray();

    for (const legacyAgent of sampleAgents) {
      const v3Agent = await v3Collection.findOne({ _id: legacyAgent._id });
      
      if (!v3Agent) {
        report.addError('Agent', legacyAgent._id, 'existence', 'No encontrado en V3');
        continue;
      }

      // Verificar email
      if (legacyAgent.email) {
        if (!v3Agent.email || v3Agent.email.toLowerCase() !== legacyAgent.email.toLowerCase()) {
          report.addWarning('Agent', legacyAgent._id, 'email', 
            `Email no coincide. Legacy: ${legacyAgent.email}, V3: ${v3Agent.email}`);
        }
      }

      // Verificar nombre
      if (legacyAgent.name || legacyAgent.lastName) {
        const expectedName = `${legacyAgent.name || ''} ${legacyAgent.lastName || ''}`.trim();
        if (!v3Agent.nombre_razon_social?.includes(expectedName)) {
          report.addWarning('Agent', legacyAgent._id, 'name', 
            `Nombre no coincide. Esperado incluye "${expectedName}", V3: ${v3Agent.nombre_razon_social}`);
        }
      }
    }

    // 4. Verificar que no haya agentes extra en V3 que no estén en Legacy
    logger.info('🔍 Verificando agentes extra en V3...');
    const v3Count = await v3Collection.countDocuments({});
    const legacyCount = await legacyCollection.countDocuments({});
    const extraInV3 = v3Count - legacyCount;

    if (extraInV3 > 0) {
      report.addWarning('Migration', 'extra', 'v3', 
        `V3 tiene ${extraInV3} agentes más que Legacy`);
    }

    // 5. Verificar índices únicos
    logger.info('🔍 Verificando unicidad de emails en V3...');
    const emailDuplicates = await v3Db.collection(DB_CONFIG.v3.collections.agents).aggregate([
      { $match: { email: { $exists: true, $ne: null } } },
      { $group: { _id: '$email', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]).toArray();

    if (emailDuplicates.length > 0) {
      logger.error(`❌ Encontrados ${emailDuplicates.length} emails duplicados en V3`);
      emailDuplicates.forEach(dup => {
        report.addError('Agent', 'multiple', 'email', 
          `Email duplicado en V3: ${dup._id} (${dup.count} veces)`);
      });
    } else {
      logger.success('✅ No hay emails duplicados en V3');
    }

    // Imprimir resumen
    report.printSummary();

    // Guardar reporte
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    report.saveToFile(`fase-1-validation-${timestamp}.json`);

    // Determinar resultado
    if (report.hasErrors()) {
      logger.error('❌ La validación encontró errores críticos.');
      logger.endPhase('FASE 1.3 - Validación Post-Migración de Agentes', {
        legacy: legacyCount,
        v3: v3Count,
        errors: report.getErrorCount(),
        warnings: report.getWarningCount(),
        valid: false,
      });
      process.exit(1);
    } else {
      logger.success('✅ Validación completada exitosamente. La migración de agentes es correcta.');
      logger.endPhase('FASE 1.3 - Validación Post-Migración de Agentes', {
        legacy: legacyCount,
        v3: v3Count,
        errors: 0,
        warnings: report.getWarningCount(),
        valid: true,
      });
    }

  } catch (error) {
    logger.error('Error fatal durante validación:', error);
    throw error;
  } finally {
    await dbConnections.closeAll();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  validateAgentsMigration()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Error fatal:', error);
      process.exit(1);
    });
}

export { validateAgentsMigration };
