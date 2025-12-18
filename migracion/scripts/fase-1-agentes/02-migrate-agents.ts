import { ObjectId } from 'mongodb';
import { dbConnections, DB_CONFIG } from '../../configuracion/conexiones.config';
import { logger } from '../utils/logger';
import { Validators } from '../utils/validators';
import { DbHelpers } from '../utils/db-helpers';

/**
 * FASE 1 - PASO 2: Migración de Agentes (VERSIÓN ACTUALIZADA)
 * 
 * Este script migra los agentes desde Legacy a V3 con el mapeo correcto.
 * 
 * CRÍTICO: Preserva los _id originales para mantener la integridad referencial.
 * 
 * Proceso:
 * 1. Leer agentes de Legacy
 * 2. Hacer lookup de Province/Locality por Legacy state.id y city.id
 * 3. Transformar según el schema V3 real
 * 4. Insertar en V3 con el mismo _id
 * 5. Registrar estadísticas
 */

interface LegacyAgent {
  _id: any;
  name?: string;
  lastName?: string;
  personType?: string;          // "Física" o "Jurídica"
  identityCard?: string;         // DNI
  email?: string;
  phone?: Array<{ number: string }>;
  address?: string;              // Dirección texto plano
  taxAddress?: string;           // Dirección fiscal
  state?: { id: string; nombre: string };
  city?: { id: string; nombre: string };
  agentType?: string;            // "Cliente", "Proveedor", "Consorcio", etc.
  taxId?: string;                // CUIT already in Legacy
  taxType?: string;              // "Responsable Inscripto", "Consumidor Final", etc.
  taxIdType?: string;            // "80" for CUIT
  gender?: string;               // "Masculino", "Femenino"
  bankAccount?: any[];
  supplierMask?: any;
  consortiumDetails?: any[];
  createdAt?: Date;
}

interface V3Agent {
  _id: ObjectId;
  rol: string[];
  persona_tipo: string;
  nomenclador_fiscal: string;
  identificador_fiscal: string;
  cuit_validado: boolean;
  nombre_razon_social: string;
  nombres?: string;
  apellidos?: string;
  genero?: string;
  documento_tipo?: string;
  documento_numero?: string;
  direccion_real?: any;
  direccion_fiscal: any;
  telefonos?: Array<{ numero: string; tipo: string }>;
  email_principal?: string;
  cuentas_bancarias?: any[];
  status: string;
  _legacyLocationIds?: any;
  _legacyData?: any;
  _migrationNotes: string[];
  redes_sociales: any[];
}

// Mapeo de roles
const AGENT_TYPE_TO_ROL: Record<string, string[]> = {
  'Cliente': [],  // Se deja vacío para asignación manual como en el ejemplo
  'Proveedor': ['PROVEEDOR'],
  'Consorcio': ['CLIENTE'],
  'Empresa de Servicios': ['PROVEEDOR'],
  'Inmobiliaria': ['INMOBILIARIA'],
};

// Mapeo de tipo fiscal
const TAX_TYPE_TO_NOMENCLADOR: Record<string, string> = {
  'Responsable Inscripto': 'RI',
  'Consumidor Final': 'CF',
  'Monotributo': 'MONOTRIBUTO',
};

// Mapeo de género
const GENDER_MAP: Record<string, string> = {
  'Masculino': 'MASCULINO',
  'Femenino': 'FEMENINO',
};

/**
 * Transforma un agente de Legacy a formato V3
 */
async function transformAgent(legacyAgent: LegacyAgent, provinceMap: Map<string, ObjectId>, localityMap: Map<string, ObjectId>): Promise<V3Agent | null> {
  const migrationNotes: string[] = [];

  // 1. Determinar persona_tipo
  const personaTipo = legacyAgent.personType === 'Jurídica' || 
                      legacyAgent.agentType === 'Consorcio' || 
                      legacyAgent.agentType === 'Empresa de Servicios' 
    ? 'JURIDICA' 
    : 'FISICA';

  // 2. Determinar nomenclador_fiscal
  let nomencladorFiscal = 'CF';  // Por defecto
  if (legacyAgent.taxType) {
    nomencladorFiscal = TAX_TYPE_TO_NOMENCLADOR[legacyAgent.taxType] || 'CF';
  }

  // 3. Determinar identificador_fiscal
  let identificadorFiscal: string;
  if (legacyAgent.taxId) {
    identificadorFiscal = legacyAgent.taxId;
  } else if (legacyAgent.identityCard && personaTipo === 'FISICA') {
    // Generar CUIT from DNI: 20-DNI-X o 27-DNI-X
    const prefix = legacyAgent.gender === 'Masculino' ? '20' : '27';
    // En producción, calcular dígito verificador real
    const dni = legacyAgent.identityCard;
    // Por ahora, generamos un CUIT simple (sin dígito verificador real)
    identificadorFiscal = `${prefix}${dni}${Math.floor(Math.random() * 10)}`;
    migrationNotes.push('CUIT generated from DNI without real verification digit');
  } else {
    // Temporal ID
    identificadorFiscal = `TEMP-${legacyAgent._id}`;
    migrationNotes.push('Temporary fiscal ID generated - requires manual update');
  }

  // 4. Nombre razon social
  const nombreRazonSocial = legacyAgent.name && legacyAgent.lastName
    ? `${legacyAgent.name} ${legacyAgent.lastName}`.trim()
    : legacyAgent.name || `Agent ${legacyAgent._id}`;

  // 5. Teléfonos
  const telefonos = legacyAgent.phone?.map(p => ({
    numero: Validators.normalizePhone(p.number) || p.number,
    tipo: 'MOVIL',  // Por defecto
  })) || [];

  // 6. Direcciones con lookup de provincias/localidades
  let direccionReal: any = undefined;
  let direccionFiscal: any;

  // HACK: Ubicaciones por defecto según provincia
  const DEFAULT_LOCATIONS: Record<string, { state: string; city: string }> = {
    '26': { state: '26', city: '260112' },   // Chubut → Rawson
    '06': { state: '6', city: '60441' },     // Buenos Aires → La Plata (municipio.id)
    '6': { state: '6', city: '60441' },      // Buenos Aires (sin cero inicial)
    '02': { state: '2', city: '22084' },     // CABA → Comuna 12
    '2': { state: '2', city: '22084' },      // CABA (sin cero inicial)
  };

  const DEFAULT_STATE_ID = '26';    // Fallback final: Chubut
  const DEFAULT_CITY_ID = '260112';  // Fallback final: Rawson
  
  let stateId = legacyAgent.state?.id || DEFAULT_STATE_ID;
  let cityId = legacyAgent.city?.id || DEFAULT_CITY_ID;

  let provincia_id = provinceMap.get(stateId);
  let localidad_id = localityMap.get(cityId);

  // Si la localidad no se encuentra, usar default de esa provincia
  if (provincia_id && !localidad_id) {
    const defaultForProvince = DEFAULT_LOCATIONS[stateId];
    if (defaultForProvince) {
      cityId = defaultForProvince.city;
      localidad_id = localityMap.get(cityId);
      migrationNotes.push(`Default locality used for province ${stateId}: ${cityId}`);
    }
  }

  // Si aún no hay provincia o localidad, usar fallback global
  if (!provincia_id || !localidad_id) {
    const defaultLocation = DEFAULT_LOCATIONS[DEFAULT_STATE_ID];
    stateId = defaultLocation.state;
    cityId = defaultLocation.city;
    provincia_id = provinceMap.get(stateId);
    localidad_id = localityMap.get(cityId);
    migrationNotes.push('Global default location (Rawson, Chubut) used');
  }

  if (!provincia_id || !localidad_id) {
    logger.warning(`Agent ${legacyAgent._id}: No se pudo mapear ubicación. state=${stateId}, city=${cityId}`);
    migrationNotes.push(`Failed to map location: state=${stateId}, city=${cityId}`);
    return null;
  }

  const wasDefaultLocation = (!legacyAgent.state || !legacyAgent.city);
  if (wasDefaultLocation) {
    migrationNotes.push('Default location used - no location data in Legacy');
  }

  direccionReal = {
    calle: legacyAgent.address || 'Sin dirección especificada',
    numero: '',
    piso_dpto: '',
    provincia_id,
    localidad_id,
    codigo_postal: '',
  };

  // Direccion fiscal
  direccionFiscal = {
    calle: legacyAgent.taxAddress || legacyAgent.address || 'Sin dirección especificada',
    numero: '',
    piso_dpto: '',
    provincia_id,
    localidad_id,
    codigo_postal: '',
  };

  // 7. Rol
  const rol = AGENT_TYPE_TO_ROL[legacyAgent.agentType || ''] || [];
  if (legacyAgent.agentType === 'Cliente') {
    migrationNotes.push('Role "Cliente" left empty for manual assignment');
  }

  // 8. Género
  const genero = legacyAgent.gender ? GENDER_MAP[legacyAgent.gender] : undefined;

  return {
    _id: Validators.toObjectId(legacyAgent._id)!,
    rol,
    persona_tipo: personaTipo,
    nomenclador_fiscal: nomencladorFiscal,
    identificador_fiscal: identificadorFiscal,
    cuit_validado: false,
    nombre_razon_social: nombreRazonSocial,
    nombres: legacyAgent.name ? Validators.cleanString(legacyAgent.name) : undefined,
    apellidos: legacyAgent.lastName ? Validators.cleanString(legacyAgent.lastName) : undefined,
    genero,
    documento_tipo: legacyAgent.identityCard ? 'DNI' : undefined,
    documento_numero: legacyAgent.identityCard,
    direccion_real: direccionReal,
    direccion_fiscal: direccionFiscal,
    telefonos,
    email_principal: legacyAgent.email ? Validators.normalizeEmail(legacyAgent.email) : undefined,
    cuentas_bancarias: [],  // TODO: Mapear bankAccount si tiene estructura
    status: 'ACTIVO',
    _legacyLocationIds: legacyAgent.state || legacyAgent.city ? {
      state: legacyAgent.state,
      city: legacyAgent.city,
    } : undefined,
    _legacyData: {
      agentType: legacyAgent.agentType,
      supplierMask: legacyAgent.supplierMask,
      consortiumDetails: legacyAgent.consortiumDetails || [],
      createdAt: legacyAgent.createdAt,
    },
    _migrationNotes: migrationNotes,
    redes_sociales: [],
  };
}

async function migrateAgents(options: { dryRun?: boolean; truncateFirst?: boolean } = {}) {
  logger.startPhase('FASE 1.2 - Migración de Agentes (ACTUALIZADO)');

  const { dryRun = false, truncateFirst = false } = options;

  if (dryRun) {
    logger.warning('⚠️  MODO DRY-RUN ACTIVADO - No se harán cambios en la base de datos');
  }

  if (truncateFirst) {
    logger.warning('⚠️  SE ELIMINARÁN TODOS LOS AGENTES EXISTENTES EN V3');
  }

  try {
    // Conectar a ambas bases de datos
    const legacyDb = await dbConnections.getLegacyDB();
    const v3Db = await dbConnections.getV3DB();

    const legacyCollection = legacyDb.collection<LegacyAgent>(DB_CONFIG.legacy.collections.agents);
    const v3Collection = v3Db.collection<any>('agents');

    // 1. Truncar colección V3 si se indica
    if (truncateFirst && !dryRun) {
      await DbHelpers.truncateCollection(v3Db, 'agents');
    }

    // 2. Cargar mapeos de provincias y localidades
    logger.info('📍 Cargando mapeo de Provincias y Localidades...');
    const provinceMap = new Map<string, ObjectId>();
    const localityMap = new Map<string, ObjectId>();

    const provinces = await v3Db.collection('provinces').find({}).toArray();
    provinces.forEach(p => {
      provinceMap.set(String(p.id), p._id);
    });
    logger.success(`Provincias cargadas: ${provinceMap.size}`);

    const localities = await v3Db.collection('localities').find({}).toArray();
    localities.forEach(l => {
      // Mapear por municipio.id (que coincide con city.id de Legacy)
      if (l.municipio && l.municipio.id) {
        localityMap.set(String(l.municipio.id), l._id);
      }
    });
    logger.success(`Localidades cargadas: ${localityMap.size}`);

    // 3. Leer agentes de Legacy
    logger.info('📖 Leyendo agentes de Legacy...');
    const legacyAgents = await legacyCollection.find({}).toArray();
    logger.info(`Total de agentes a migrar: ${legacyAgents.length}`);

    // 4. Transformar agentes
    logger.info('🔄 Transformando agentes...');
    const v3Agents: V3Agent[] = [];
    let skipped = 0;

    for (const legacyAgent of legacyAgents) {
      try {
        const v3Agent = await transformAgent(legacyAgent, provinceMap, localityMap);
        if (v3Agent) {
          v3Agents.push(v3Agent);
        } else {
          skipped++;
        }
      } catch (error) {
        logger.error(`Error transformando agente ${legacyAgent._id}:`, error);
        skipped++;
      }
    }

    logger.success(`Agentes transformados: ${v3Agents.length}`);
    if (skipped > 0) {
      logger.warning(`Agentes omitidos (sin ubicación o errores): ${skipped}`);
    }

    // 5. Insertar en V3
    if (!dryRun) {
      logger.info('💾 Insertando agentes en V3...');
      
      const stats = await DbHelpers.bulkInsertWithDuplicateHandling(
        v3Collection,
        v3Agents,
        { continueOnError: true },
      );

      logger.success(`Agentes insertados: ${stats.inserted}`);
      if (stats.duplicates > 0) {
        logger.warning(`Agentes duplicados (omitidos): ${stats.duplicates}`);
      }
      if (stats.errors.length > 0) {
        logger.error(`Errores durante inserción: ${stats.errors.length}`);
        stats.errors.slice(0, 5).forEach(err => {
          logger.error(`  - ${err.doc._id}:`, err.error.message);
        });
      }

      // 6. Verificar conteos
      logger.info('🔍 Verificando conteos...');
      const legacyCount = legacyAgents.length;
      const v3Count = await v3Collection.countDocuments({});
      logger.info(`Legacy: ${legacyCount}, V3: ${v3Count}, Omitidos: ${skipped}`);

      // 7. Generar reportes JSON
      logger.info('📄 Generando reportes JSON...');
      const fs = require('fs');
      const path = require('path');
      
      const reportDir = path.join(__dirname, '..', '..', 'validacion', 'reports');
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Reporte de estadísticas
      const statsReport = {
        timestamp: new Date().toISOString(),
        fase: 'Fase 1 - Migración de Agentes',
        estadisticas: {
          legacy: legacyCount,
          transformados: v3Agents.length,
          omitidos: skipped,
          insertados: stats.inserted,
          duplicados: stats.duplicates,
          errores: stats.errors.length,
          tasa_exito: ((stats.inserted / legacyCount) * 100).toFixed(2) + '%',
        },
        colecciones: {
          provincias_cargadas: provinceMap.size,
          localidades_cargadas: localityMap.size,
        },
      };
      
      const statsPath = path.join(reportDir, `migracion-agentes-stats-${timestamp}.json`);
      fs.writeFileSync(statsPath, JSON.stringify(statsReport, null, 2));
      logger.success(`Reporte de estadísticas guardado: ${statsPath}`);

      // Reporte de agentes omitidos (para revisión manual)
      if (skipped > 0) {
        const skippedAgentsPath = path.join(reportDir, `migracion-agentes-omitidos-${timestamp}.json`);
        // Filtrar los agentes que no fueron transformados
        const skippedAgentIds: any[] = [];
        
        for (const legacyAgent of legacyAgents) {
          const legacyIdStr = String(legacyAgent._id);
          const found = v3Agents.find(v => v._id.toString() === legacyIdStr);
          if (!found) {
            skippedAgentIds.push({
              _id: String(legacyAgent._id),
              nombre: `${legacyAgent.name || ''} ${legacyAgent.lastName || ''}`.trim(),
              email: legacyAgent.email,
              state: legacyAgent.state,
              city: legacyAgent.city,
              razon: !legacyAgent.state && !legacyAgent.city ? 'Sin información de ubicación' : 'Localidad no mapeada'
            });
          }
        }
        
        fs.writeFileSync(skippedAgentsPath, JSON.stringify({
          total_omitidos: skipped,
          agentes: skippedAgentIds
        }, null, 2));
        logger.warning(`Agentes omitidos guardados para revisión: ${skippedAgentsPath}`);
      }

      // Muestra de agentes migrados (primeros 10)
      const samplePath = path.join(reportDir, `migracion-agentes-muestra-${timestamp}.json`);
      fs.writeFileSync(samplePath, JSON.stringify({
        total: v3Agents.length,
        muestra: v3Agents.slice(0, 10)
      }, null, 2));
      logger.info(`Muestra de agentes migrados guardada: ${samplePath}`);

      logger.endPhase('FASE 1.2 - Migración de Agentes', {
        legacy: legacyCount,
        transformed: v3Agents.length,
        skipped,
        inserted: stats.inserted,
        duplicates: stats.duplicates,
        errors: stats.errors.length,
      });

    } else {
      logger.info('💾 [DRY-RUN] Se habrían insertado los agentes en V3');
      logger.info(`Muestra de agentes transformados (primeros 3):`);
      v3Agents.slice(0, 3).forEach(agent => {
        logger.info(JSON.stringify(agent, null, 2));
      });

      logger.endPhase('FASE 1.2 - Migración de Agentes (DRY-RUN)', {
        legacy: legacyAgents.length,
        transformed: v3Agents.length,
        skipped,
      });
    }

  } catch (error) {
    logger.error('Error fatal durante migración:', error);
    throw error;
  } finally {
    await dbConnections.closeAll();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const options = {
    dryRun: process.argv.includes('--dry-run'),
    truncateFirst: process.argv.includes('--truncate'),
  };

  migrateAgents(options)
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Error fatal:', error);
      process.exit(1);
    });
}

export { migrateAgents };
