import { dbConnections, DB_CONFIG } from '../../configuracion/conexiones.config';
import { logger } from '../utils/logger';
import { Validators, ValidationReport } from '../utils/validators';

/**
 * FASE 1 - PASO 1: Sanity Check de Agentes
 * 
 * Este script realiza validaciones preliminares sobre los datos de Agentes
 * en Legacy antes de iniciar la migración.
 * 
 * Validaciones:
 * - Detectar emails duplicados
 * - Detectar emails inválidos
 * - Verificar campos requeridos
 * - Identificar datos inconsistentes
 */

interface LegacyAgent {
  _id: any;
  name?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  // Agregar otros campos según el schema real de Legacy
}

async function sanityCheckAgents() {
  logger.startPhase('FASE 1.1 - Sanity Check de Agentes');

  try {
    // Conectar a Legacy
    const legacyDb = await dbConnections.getLegacyDB();
    const agentsCollection = legacyDb.collection<LegacyAgent>(DB_CONFIG.legacy.collections.agents);

    // Obtener todos los agentes
    const agents = await agentsCollection.find({}).toArray();
    logger.info(`Total de agentes en Legacy: ${agents.length}`);

    const report = new ValidationReport();

    // 1. Verificar emails duplicados
    logger.info('🔍 Verificando emails duplicados...');
    const emailMap = new Map<string, number>();
    
    for (const agent of agents) {
      if (agent.email) {
        const normalizedEmail = Validators.normalizeEmail(agent.email);
        emailMap.set(normalizedEmail, (emailMap.get(normalizedEmail) || 0) + 1);
      }
    }

    const duplicateEmails = Array.from(emailMap.entries())
      .filter(([_, count]) => count > 1)
      .map(([email, count]) => ({ email, count }));

    if (duplicateEmails.length > 0) {
      logger.warning(`⚠️  Encontrados ${duplicateEmails.length} emails duplicados (se permitirá continuar)`);
      duplicateEmails.forEach(({ email, count }) => {
        report.addWarning('Agent', 'multiple', 'email', `Email duplicado: ${email} (${count} veces)`);
      });
    } else {
      logger.success('✅ No se encontraron emails duplicados');
    }

    // 2. Verificar emails inválidos
    logger.info('🔍 Verificando validez de emails...');
    let invalidEmailCount = 0;

    for (const agent of agents) {
      if (agent.email) {
        if (!Validators.isValidEmail(agent.email)) {
          invalidEmailCount++;
          report.addError('Agent', agent._id, 'email', `Email inválido: ${agent.email}`);
        }
      }
    }

    if (invalidEmailCount > 0) {
      logger.warning(`⚠️  Encontrados ${invalidEmailCount} emails inválidos`);
    } else {
      logger.success('✅ Todos los emails son válidos');
    }

    // 3. Verificar campos requeridos
    logger.info('🔍 Verificando campos requeridos...');
    const requiredFields = ['_id', 'name', 'email']; // Ajustar según schema real

    for (const agent of agents) {
      const validation = Validators.hasRequiredFields(agent, requiredFields);
      if (!validation.valid) {
        report.addError(
          'Agent',
          agent._id,
          validation.missing.join(', '),
          'Campos requeridos faltantes',
        );
      }
    }

    // 4. Verificar ObjectIds válidos
    logger.info('🔍 Verificando ObjectIds válidos...');
    let invalidIdCount = 0;

    for (const agent of agents) {
      if (!Validators.isValidObjectId(agent._id)) {
        invalidIdCount++;
        report.addError('Agent', agent._id, '_id', 'ObjectId inválido');
      }
    }

    if (invalidIdCount > 0) {
      logger.error(`❌ Encontrados ${invalidIdCount} ObjectIds inválidos`);
    } else {
      logger.success('✅ Todos los ObjectIds son válidos');
    }

    // Imprimir resumen
    report.printSummary();

    // Guardar reporte
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    report.saveToFile(`fase-1-sanity-check-${timestamp}.json`);

    // Determinar si se puede proceder
    if (report.hasErrors()) {
      logger.error('❌ Se encontraron errores críticos. Corrija estos problemas antes de continuar.');
      logger.endPhase('FASE 1.1 - Sanity Check de Agentes', {
        total: agents.length,
        errors: report.getErrorCount(),
        warnings: report.getWarningCount(),
        canProceed: false,
      });
      process.exit(1);
    } else if (report.hasWarnings()) {
      logger.warning('⚠️  Se encontraron advertencias, pero puede proceder a la migración.');
      logger.success('✅ No hay errores críticos. Puede proceder con precaución.');
      logger.endPhase('FASE 1.1 - Sanity Check de Agentes', {
        total: agents.length,
        errors: 0,
        warnings: report.getWarningCount(),
        canProceed: true,
      });
    } else {
      logger.success('✅ Sanity check completado exitosamente. Puede proceder a la migración.');
      logger.endPhase('FASE 1.1 - Sanity Check de Agentes', {
        total: agents.length,
        errors: 0,
        warnings: report.getWarningCount(),
        canProceed: true,
      });
    }

  } catch (error) {
    logger.error('Error fatal durante sanity check:', error);
    throw error;
  } finally {
    await dbConnections.closeAll();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  sanityCheckAgents()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Error fatal:', error);
      process.exit(1);
    });
}

export { sanityCheckAgents };
