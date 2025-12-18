import { dbConnections } from '../configuracion/conexiones.config';
import { logger } from '../scripts/utils/logger';
import { DbHelpers } from '../scripts/utils/db-helpers';
import { ValidationReport } from '../scripts/utils/validators';

/**
 * Script de Validación de Integridad General
 * 
 * Este script verifica la integridad referencial completa después de todas las fases.
 * Debe ejecutarse al final de la migración completa.
 * 
 * Validaciones:
 * - Todos los agentes referenciados existen
 * - Todas las propiedades tienen propietarios válidos
 * - Todos los contratos tienen referencias válidas
 * - Todos los asientos contables tienen referencias válidas
 */

async function validateIntegrity() {
  logger.startPhase('VALIDACIÓN DE INTEGRIDAD GENERAL');

  try {
    const v3Db = await dbConnections.getV3DB();
    const report = new ValidationReport();

    // 1. Validar Propiedades → Agentes
    logger.info('🔍 Validando Propiedades → Agentes...');
    const orphanedProperties = await DbHelpers.findOrphans(
      v3Db,
      'properties',
      'propietario_id',
      'agents',
    );

    if (orphanedProperties.length > 0) {
      logger.error(`❌ Encontradas ${orphanedProperties.length} propiedades huérfanas`);
      orphanedProperties.slice(0, 10).forEach(prop => {
        report.addError('Property', prop._id, 'propietario_id', 
          `Propietario no existe: ${prop.propietario_id}`);
      });
    } else {
      logger.success('✅ Todas las propiedades tienen propietarios válidos');
    }

    // 2. Validar Contratos → Propiedades
    logger.info('🔍 Validando Contratos → Propiedades...');
    const orphanedContractsByProperty = await DbHelpers.findOrphans(
      v3Db,
      'leaseagreements',
      'propiedad_id',
      'properties',
    );

    if (orphanedContractsByProperty.length > 0) {
      logger.error(`❌ Encontrados ${orphanedContractsByProperty.length} contratos con propiedades inexistentes`);
      orphanedContractsByProperty.slice(0, 10).forEach(contract => {
        report.addError('Contract', contract._id, 'propiedad_id', 
          `Propiedad no existe: ${contract.propiedad_id}`);
      });
    } else {
      logger.success('✅ Todos los contratos tienen propiedades válidas');
    }

    // 3. Validar Contratos → Agentes (Locador)
    logger.info('🔍 Validando Contratos → Locadores...');
    const orphanedContractsByLandlord = await DbHelpers.findOrphans(
      v3Db,
      'leaseagreements',
      'locador_id',
      'agents',
    );

    if (orphanedContractsByLandlord.length > 0) {
      logger.error(`❌ Encontrados ${orphanedContractsByLandlord.length} contratos con locadores inexistentes`);
      orphanedContractsByLandlord.slice(0, 10).forEach(contract => {
        report.addError('Contract', contract._id, 'locador_id', 
          `Locador no existe: ${contract.locador_id}`);
      });
    } else {
      logger.success('✅ Todos los contratos tienen locadores válidos');
    }

    // 4. Validar Contratos → Agentes (Locatario)
    logger.info('🔍 Validando Contratos → Locatarios...');
    const orphanedContractsByTenant = await DbHelpers.findOrphans(
      v3Db,
      'leaseagreements',
      'locatario_id',
      'agents',
    );

    if (orphanedContractsByTenant.length > 0) {
      logger.error(`❌ Encontrados ${orphanedContractsByTenant.length} contratos con locatarios inexistentes`);
      orphanedContractsByTenant.slice(0, 10).forEach(contract => {
        report.addError('Contract', contract._id, 'locatario_id', 
          `Locatario no existe: ${contract.locatario_id}`);
      });
    } else {
      logger.success('✅ Todos los contratos tienen locatarios válidos');
    }

    // 5. Validar Transacciones → Contratos
    logger.info('🔍 Validando Transacciones → Contratos...');
    const orphanedTransactions = await DbHelpers.findOrphans(
      v3Db,
      'transactions',
      'contrato_id',
      'leaseagreements',
    );

    if (orphanedTransactions.length > 0) {
      logger.error(`❌ Encontradas ${orphanedTransactions.length} transacciones con contratos inexistentes`);
      orphanedTransactions.slice(0, 10).forEach(trans => {
        report.addError('Transaction', trans._id, 'contrato_id', 
          `Contrato no existe: ${trans.contrato_id}`);
      });
    } else {
      logger.success('✅ Todas las transacciones tienen contratos válidos');
    }

    // 6. Resumen de conteos
    logger.separator();
    logger.info('📊 RESUMEN DE CONTEOS');
    
    const agentsCount = await DbHelpers.countDocuments(v3Db, 'agents');
    const propertiesCount = await DbHelpers.countDocuments(v3Db, 'properties');
    const contractsCount = await DbHelpers.countDocuments(v3Db, 'leaseagreements');
    const transactionsCount = await DbHelpers.countDocuments(v3Db, 'transactions');

    logger.info(`Agentes: ${agentsCount}`);
    logger.info(`Propiedades: ${propertiesCount}`);
    logger.info(`Contratos: ${contractsCount}`);
    logger.info(`Transacciones: ${transactionsCount}`);

    // Imprimir reporte
    report.printSummary();

    // Guardar reporte
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    report.saveToFile(`integrity-check-${timestamp}.json`);

    // Conclusión
    if (report.hasErrors()) {
      logger.error('❌ Se encontraron errores de integridad referencial');
      logger.error('⚠️  La migración requiere correcciones antes de usar en producción');
      logger.endPhase('VALIDACIÓN DE INTEGRIDAD GENERAL', {
        agents: agentsCount,
        properties: propertiesCount,
        contracts: contractsCount,
        transactions: transactionsCount,
        errors: report.getErrorCount(),
        warnings: report.getWarningCount(),
        valid: false,
      });
      process.exit(1);
    } else {
      logger.success('✅ INTEGRIDAD REFERENCIAL VERIFICADA');
      logger.success('✅ La migración está completa y es consistente');
      logger.endPhase('VALIDACIÓN DE INTEGRIDAD GENERAL', {
        agents: agentsCount,
        properties: propertiesCount,
        contracts: contractsCount,
        transactions: transactionsCount,
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
  validateIntegrity()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Error fatal:', error);
      process.exit(1);
    });
}

export { validateIntegrity };
