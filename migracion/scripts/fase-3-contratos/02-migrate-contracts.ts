import { ObjectId } from 'mongodb';
import { dbConnections } from '../../configuracion/conexiones.config';
import { logger } from '../utils/logger';
import { Validators } from '../utils/validators';
import { DbHelpers } from '../utils/db-helpers';

/**
 * FASE 3 - PASO 2: Migración de Contratos con Desnormalización
 * 
 * CRÍTICO: Requiere Agents y Properties ya migrados.
 * INNOVACIÓN: Incluye campos `_search` para optimizar búsquedas.
 */

interface LegacyContract {
  _id: any;
  property?: { _id: any; address?: string };
  realtor?: { _id: any; fullName?: string };
  leaseHolder?: Array<{ _id: any; fullName?: string }>;
  tenant?: Array<{ _id: any; fullName?: string }>;
  guarantor?: Array<{ _id: any; fullName?: string }>;
  startDate?: Date;
  expiresAt?: Date;
  length?: number;
  rentAmount?: number;
  rentIncrease?: number;
  rentIncreaseType?: string;
  rentIncreaseFixed?: boolean;
  rentIncreasePeriod?: number;
  adminFee?: number;
  interest?: number;
  leaseHolderFee?: number;
  leaseHolderAmountOfFees?: number;
  tenantFee?: number;
  tenantAmountOfFees?: number;
  depositAmount?: number;
  depositLength?: number;
  type?: string;
  use?: string;
  status?: boolean;
  icl?: number;
  paymentTerm?: number;
  depositType?: string;
  expensesType?: string;
  expensesAmount?: number;
  user?: any;
  createdAt?: Date;
  changedAt?: Date;
  contrato?: string;
  touched?: boolean;
}

interface V3Contract {
  _id: ObjectId;
  propiedad_id: ObjectId;
  partes: Array<{ agente_id: ObjectId; rol: string }>;
  fecha_inicio: Date;
  fecha_final: Date;
  duracion_meses: number;
  tipo_contrato: string;
  status: string;
  terminos_financieros: {
    monto_base_vigente: number;
    indice_tipo: string;
    ajuste_porcentaje: number;
    ajuste_perioricidad_meses: number;
    ajuste_es_fijo: boolean;
    comision_administracion_porcentaje: number;
    honorarios_locador_porcentaje: number;
    honorarios_locador_cuotas: number;
    honorarios_locatario_porcentaje: number;
    honorarios_locatario_cuotas: number;
    interes_mora_diaria: number;
    indice_valor_inicial: number;
    iva_calculo_base: string;
  };
  deposito_monto?: number;
  deposito_cuotas?: number;
  deposito_tipo_ajuste?: string;
  firmas_completas: boolean;
  documentacion_completa: boolean;
  visita_realizada: boolean;
  inventario_actualizado: boolean;
  fotos_inventario: string[];
  inventory_version_id?: ObjectId | null;
  servicios_impuestos_contrato: any[];
  rescision_dias_preaviso_minimo: number;
  rescision_dias_sin_penalidad: number;
  rescision_porcentaje_penalidad: number;
  fecha_recision_anticipada?: Date | null;
  fecha_notificacion_rescision?: Date | null;
  penalidad_rescision_monto?: number;
  penalidad_rescision_motivo?: string;
  ajuste_programado?: Date | null;
  usuario_creacion_id?: ObjectId | null;
  usuario_modificacion_id?: ObjectId | null;
  _search?: {
    propiedad_direccion?: string;
    propiedad_provincia?: string;
    propiedad_provincia_id?: ObjectId;
    propiedad_localidad?: string;
    propiedad_localidad_id?: ObjectId;
    locador_nombre?: string;
    locador_id?: ObjectId;
    locatario_nombre?: string;
    locatario_id?: ObjectId;
    fiador_nombre?: string;
    fiador_id?: ObjectId | null;
  };
  _legacyData?: any;
  _migrationNotes: string[];
}

// Mapeos
const RENT_TYPE_MAP: Record<string, string> = {
  'NO REGULADO': 'FIJO',
  'ICL': 'ICL',
  'IPC': 'IPC',
};

const CONTRACT_TYPE_MAP: Record<string, string> = {
  'Vivienda': 'VIVIENDA',
  'Vivienda Única': 'VIVIENDA_UNICA',
  'Vivienda Unica': 'VIVIENDA_UNICA',
  'Comercial': 'COMERCIAL',
  'Temporario': 'TEMPORARIO',
};

async function transformContract(
  legacyContract: LegacyContract,
  v3Db: any
): Promise<V3Contract | null> {
  const migrationNotes: string[] = [];
  
  // 1. Preservar _id
  const _id = Validators.toObjectId(legacyContract._id);
  if (!_id) {
    logger.error(`Contract ${legacyContract._id}: _id inválido`);
    return null;
  }

  // 2. Validar y mapear propiedad
  const propiedad_id = Validators.toObjectId(legacyContract.property?._id);
  if (!propiedad_id) {
    migrationNotes.push('No property reference - contract skipped');
    return null;
  }

  // Lookup de Property para _search
  const property = await v3Db.collection('properties').findOne({ _id: propiedad_id });
  if (!property) {
    logger.warning(`Contract ${_id}: Property ${propiedad_id} not found in V3`);
    migrationNotes.push(`Property ${propiedad_id} not found - orphaned contract`);
    return null;
  }

  // 3. Mapear partes (locador, locatario, fiador)
  const partes: Array<{ agente_id: ObjectId; rol: string }> = [];
  
  // Locadores
  if (legacyContract.leaseHolder && legacyContract.leaseHolder.length > 0) {
    for (const lh of legacyContract.leaseHolder) {
      const agente_id = Validators.toObjectId(lh._id);
      if (agente_id) {
        partes.push({ agente_id, rol: 'LOCADOR' });
      }
    }
    if (legacyContract.leaseHolder.length > 1) {
      migrationNotes.push(`Multiple leaseHolders: ${legacyContract.leaseHolder.length}`);
    }
  }

  // Locatarios
  if (legacyContract.tenant && legacyContract.tenant.length > 0) {
    for (const t of legacyContract.tenant) {
      const agente_id = Validators.toObjectId(t._id);
      if (agente_id) {
        partes.push({ agente_id, rol: 'LOCATARIO' });
      }
    }
    if (legacyContract.tenant.length > 1) {
      migrationNotes.push(`Multiple tenants: ${legacyContract.tenant.length}`);
    }
  }

  // Fiadores
  if (legacyContract.guarantor && legacyContract.guarantor.length > 0) {
    for (const g of legacyContract.guarantor) {
      const agente_id = Validators.toObjectId(g._id);
      if (agente_id) {
        partes.push({ agente_id, rol: 'FIADOR' });
      }
    }
  }

  if (partes.length === 0) {
    migrationNotes.push('No partes (agents) found - contract skipped');
    return null;
  }

  // 4. Fechas (CRÍTICO: UTC puro, no -3h)
  const fecha_inicio = legacyContract.startDate ? new Date(legacyContract.startDate) : new Date();
  const fecha_final = legacyContract.expiresAt ? new Date(legacyContract.expiresAt) : new Date();

  // 5. Determinar status
  const now = new Date();
  let status = 'VIGENTE';
  
  if (legacyContract.status === false) {
    status = 'FINALIZADO';
  } else if (fecha_final < now) {
    status = 'FINALIZADO';
  } else if (fecha_inicio > now) {
    status = 'PENDIENTE';
  }

  // 6. Tipo de contrato
  let tipo_contrato = 'VIVIENDA';
  if (legacyContract.use) {
    tipo_contrato = CONTRACT_TYPE_MAP[legacyContract.use] || 'VIVIENDA';
  } else if (legacyContract.type) {
    tipo_contrato = CONTRACT_TYPE_MAP[legacyContract.type] || 'VIVIENDA';
  }

  // 7. Términos financieros
  const indice_tipo = RENT_TYPE_MAP[legacyContract.rentIncreaseType || 'NO REGULADO'] || 'FIJO';
  
  const terminos_financieros = {
    monto_base_vigente: legacyContract.rentAmount || 0,
    indice_tipo,
    ajuste_porcentaje: legacyContract.rentIncrease || 0,
    ajuste_perioricidad_meses: legacyContract.rentIncreasePeriod || 12,
    ajuste_es_fijo: legacyContract.rentIncreaseFixed !== false,
    comision_administracion_porcentaje: legacyContract.adminFee || 0,
    honorarios_locador_porcentaje: legacyContract.leaseHolderFee || 0,
    honorarios_locador_cuotas: legacyContract.leaseHolderAmountOfFees || 1,
    honorarios_locatario_porcentaje: legacyContract.tenantFee || 0,
    honorarios_locatario_cuotas: legacyContract.tenantAmountOfFees || 1,
    interes_mora_diaria: legacyContract.interest ? legacyContract.interest / 30 : 0,
    indice_valor_inicial: legacyContract.icl || 0,
    iva_calculo_base: 'MAS_IVA' as const,
  };

  // 8. CAMPOS _search (DESNORMALIZACIÓN)
  const _search: V3Contract['_search'] = {
    // Propiedad
    propiedad_direccion: property.direccion?.calle || legacyContract.property?.address || '',
    propiedad_provincia_id: property.direccion?.provincia_id,
    propiedad_localidad_id: property.direccion?.localidad_id,
  };

  // Lookup de Provincia para nombre
  if (_search.propiedad_provincia_id) {
    const provincia = await v3Db.collection('provinces').findOne({ _id: _search.propiedad_provincia_id });
    _search.propiedad_provincia = provincia?.nombre || '';
  }

  // Lookup de Localidad para nombre
  if (_search.propiedad_localidad_id) {
    const localidad = await v3Db.collection('localities').findOne({ _id: _search.propiedad_localidad_id });
    _search.propiedad_localidad = localidad?.nombre || '';
  }

  // Locador (primer elemento)
  if (legacyContract.leaseHolder && legacyContract.leaseHolder[0]) {
    _search.locador_id = Validators.toObjectId(legacyContract.leaseHolder[0]._id) || undefined;
    _search.locador_nombre = legacyContract.leaseHolder[0].fullName || '';
  }

  // Locatario (primer elemento)
  if (legacyContract.tenant && legacyContract.tenant[0]) {
    _search.locatario_id = Validators.toObjectId(legacyContract.tenant[0]._id) || undefined;
    _search.locatario_nombre = legacyContract.tenant[0].fullName || '';
  }

  // Fiador (primer elemento si existe)
  if (legacyContract.guarantor && legacyContract.guarantor[0]) {
    _search.fiador_id = Validators.toObjectId(legacyContract.guarantor[0]._id) || undefined;
    _search.fiador_nombre = legacyContract.guarantor[0].fullName || '';
  }

  // 9. Usuario creación
  const usuario_creacion_id = Validators.toObjectId(legacyContract.user);

  return {
    _id,
    propiedad_id,
    partes,
    fecha_inicio,
    fecha_final,
    duracion_meses: legacyContract.length || 12,
    tipo_contrato,
    status,
    terminos_financieros,
    deposito_monto: legacyContract.depositAmount,
    deposito_cuotas: legacyContract.depositLength || 1,
    deposito_tipo_ajuste: 'AL_ULTIMO_ALQUILER',
    firmas_completas: true,
    documentacion_completa: true,
    visita_realizada: true,
    inventario_actualizado: false,
    fotos_inventario: [],
    inventory_version_id: null,
    servicios_impuestos_contrato: [],
    rescision_dias_preaviso_minimo: 30,
    rescision_dias_sin_penalidad: 90,
    rescision_porcentaje_penalidad: 10,
    fecha_recision_anticipada: null,
    fecha_notificacion_rescision: null,
    penalidad_rescision_monto: 0,
    penalidad_rescision_motivo: '',
    ajuste_programado: null,
    usuario_creacion_id,
    usuario_modificacion_id: null,
    _search,
    _legacyData: {
      realtor: legacyContract.realtor,
      paymentTerm: legacyContract.paymentTerm,
      depositType: legacyContract.depositType,
      expensesType: legacyContract.expensesType,
      expensesAmount: legacyContract.expensesAmount,
      contrato: legacyContract.contrato,
      createdAt: legacyContract.createdAt,
      changedAt: legacyContract.changedAt,
      touched: legacyContract.touched,
    },
    _migrationNotes: migrationNotes,
  };
}

async function migrateContracts(options: { dryRun?: boolean; truncateFirst?: boolean } = {}) {
  logger.startPhase('FASE 3 - Migración de Contratos con _search');

  const { dryRun = false, truncateFirst = false } = options;

  if (dryRun) {
    logger.warning('⚠️  MODO DRY-RUN ACTIVADO');
  }

  try {
    const legacyDb = await dbConnections.getLegacyDB();
    const v3Db = await dbConnections.getV3DB();

    const legacyCollection = legacyDb.collection<LegacyContract>('leaseagreements');
    const v3Collection = v3Db.collection<any>('contracts');

    if (truncateFirst && !dryRun) {
      await DbHelpers.truncateCollection(v3Db, 'contracts');
    }

    // Leer contratos
    logger.info('📖 Leyendo contratos de Legacy...');
    
    // FILTRO QUIRÚRGICO (COMENTADO - Para migración masiva usar query vacío)
    // const TARGET_CONTRACT_ID = '6902560abbb2614a30d9d131'; // Retamosa/Murua
    // const query = { _id: new ObjectId(TARGET_CONTRACT_ID) };
    
    // Migración masiva: todos los contratos
    const query = {};
    
    const legacyContracts = await legacyCollection.find(query as any).toArray();
    logger.info(`Total de contratos a migrar: ${legacyContracts.length}`);

    // Transformar
    logger.info('🔄 Transformando contratos...');
    const v3Contracts: V3Contract[] = [];
    let skipped = 0;

    for (const legacyContract of legacyContracts) {
      try {
        const v3Contract = await transformContract(legacyContract, v3Db);
        if (v3Contract) {
          v3Contracts.push(v3Contract);
        } else {
          skipped++;
        }
      } catch (error) {
        logger.error(`Error transformando contrato ${legacyContract._id}:`, error);
        skipped++;
      }
    }

    logger.success(`Contratos transformados: ${v3Contracts.length}`);
    if (skipped > 0) {
      logger.warning(`Contratos omitidos: ${skipped}`);
    }

    // Insertar
    if (!dryRun) {
      logger.info('💾 Insertando contratos en V3...');
      
      const stats = await DbHelpers.bulkInsertWithDuplicateHandling(
        v3Collection,
        v3Contracts,
        { continueOnError: true },
      );

      logger.success(`Contratos insertados: ${stats.inserted}`);

      // Generar reportes
      const fs = require('fs');
      const path = require('path');
      const reportDir = path.join(__dirname, '..', '..', 'validacion', 'reports');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const statsReport = {
        timestamp: new Date().toISOString(),
        fase: 'Fase 3 - Migración de Contratos',
        estadisticas: {
          legacy: legacyContracts.length,
          transformados: v3Contracts.length,
          omitidos: skipped,
          insertados: stats.inserted,
          duplicados: stats.duplicates,
          errores: stats.errors.length,
          tasa_exito: ((stats.inserted / legacyContracts.length) * 100).toFixed(2) + '%',
        },
      };
      
      const statsPath = path.join(reportDir, `migracion-contracts-stats-${timestamp}.json`);
      fs.writeFileSync(statsPath, JSON.stringify(statsReport, null, 2));
      logger.success(`Reporte guardado: ${statsPath}`);

      logger.endPhase('FASE 3 - Migración de Contratos', {
        legacy: legacyContracts.length,
        transformed: v3Contracts.length,
        skipped,
        inserted: stats.inserted,
      });

    } else {
      logger.info('💾 [DRY-RUN] Muestra (primeros 2):');
      v3Contracts.slice(0, 2).forEach(c => {
        logger.info(JSON.stringify(c, null, 2));
      });

      logger.endPhase('FASE 3 - Migración de Contratos (DRY-RUN)', {
        legacy: legacyContracts.length,
        transformed: v3Contracts.length,
        skipped,
      });
    }

  } catch (error) {
    logger.error('Error fatal:', error);
    throw error;
  } finally {
    await dbConnections.closeAll();
  }
}

if (require.main === module) {
  const options = {
    dryRun: process.argv.includes('--dry-run'),
    truncateFirst: process.argv.includes('--truncate'),
  };

  migrateContracts(options)
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Error fatal:', error);
      process.exit(1);
    });
}

export { migrateContracts };
