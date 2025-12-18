import { ObjectId } from 'mongodb';
import { dbConnections, DB_CONFIG } from '../../configuracion/conexiones.config';
import { logger } from '../utils/logger';
import { Validators } from '../utils/validators';
import { DbHelpers } from '../utils/db-helpers';

/**
 * FASE 2 - PASO 2: Migración de Propiedades
 * 
 * CRÍTICO: Requiere que los Agents ya estén migrados (Fase 1 completa).
 * 
 * Preserva los _id originales para mantener la integridad referencial.
 */

interface LegacyProperty {
  _id: any;
  address?: string;
  owner?: Array<{ _id: any; fullName: string }>;
  city?: { id: string; nombre: string };
  state?: { id: string; nombre: string };
  description?: Array<{ ambiente: string; cantidad: number }>;
  inventory?: any[];
  specs?: any;
  associatedServices?: Array<{
    serviceCompany: { _id: any; fullName?: string };
    ratio: number;
    id: string;
    paymentTarget: string;
    paymentSource: string;
  }>;
  leaseAgreement?: any;
  tenant?: any;
  active?: boolean;
  availableAt?: Date;
  img?: any;
  imgCover?: any;
  createdAt?: Date;
}

interface V3Property {
  _id: ObjectId;
  propietarios_ids: ObjectId[];
  identificador_interno: string;
  identificador_tributario: string;
  titulo: string;
  descripcion: string;
  direccion: {
    calle: string;
    numero: string;
    piso_dpto: string;
    provincia_id: ObjectId;
    localidad_id: ObjectId;
    codigo_postal: string;
    latitud: number | null;
    longitud: number | null;
  };
  caracteristicas: {
    tipo_propiedad: string;
    dormitorios: number | null;
    banos: number | null;
    metraje_total: number | null;
    metraje_cubierto: number | null;
    antiguedad_anos: number | null;
    orientacion: string | null;
  };
  servicios_impuestos: Array<{
    proveedor_id: ObjectId;
    identificador_servicio: string;
    porcentaje_aplicacion: number;
    origen: string;
    destino: string;
  }>;
  consorcio_nombre: string;
  tipo_expensas: string | null;
  img_cover_url: string;
  valor_venta: number | null;
  valor_alquiler: number | null;
  publicar_para_venta: boolean;
  publicar_para_alquiler: boolean;
  proposito: string;
  status: string;
  estado_ocupacional: string;
  contrato_vigente_id: ObjectId | null;
  imagenes: any[];
  usuario_creacion_id: ObjectId | null;
  _legacyLocationIds?: any;
  _legacyData?: any;
  _migrationNotes: string[];
}

// Mapeo de origen/destino de pagos
const PAYMENT_SOURCE_MAP: Record<string, string> = {
  'Locatario': 'LOCATARIO',
  'Locador': 'LOCADOR',
  'Propietario': 'LOCADOR',
};

const PAYMENT_TARGET_MAP: Record<string, string> = {
  'Prestador': 'PRESTADOR',
  'Locador': 'LOCADOR',
  'Locatario': 'LOCATARIO',
  'Propietario': 'LOCADOR',
};

/**
 * Extraer número de dormitorios de description
 */
function extractDormitorios(description?: Array<{ ambiente: string; cantidad: number }>): number | null {
  if (!description) return null;
  
  const dormitorio = description.find(d => 
    d.ambiente.toLowerCase().includes('dormitorio')
  );
  
  return dormitorio?.cantidad || null;
}

/**
 * Extraer número de baños de description
 */
function extractBanos(description?: Array<{ ambiente: string; cantidad: number }>): number | null {
  if (!description) return null;
  
  const bano = description.find(d => 
    d.ambiente.toLowerCase().includes('baño') || 
    d.ambiente.toLowerCase().includes('bano')
  );
  
  return bano?.cantidad || null;
}

/**
 * Transforma una propiedad de Legacy a formato V3
 */
async function transformProperty(
  legacyProperty: LegacyProperty,
  provinceMap: Map<string, ObjectId>,
  localityMap: Map<string, ObjectId>
): Promise<V3Property | null> {
  const migrationNotes: string[] = [];

  // 1. Preservar _id
  const _id = Validators.toObjectId(legacyProperty._id);
  if (!_id) {
    logger.error(`Property ${legacyProperty._id}: _id inválido`);
    return null;
  }

  // 2. Generar identificador interno
  const identificador_interno = `PROP-${_id.toString().slice(-8).toUpperCase()}`;

  // 3. Propietarios
  const propietarios_ids: ObjectId[] = [];
  if (legacyProperty.owner && legacyProperty.owner.length > 0) {
    for (const owner of legacyProperty.owner) {
      const ownerId = Validators.toObjectId(owner._id);
      if (ownerId) {
        propietarios_ids.push(ownerId);
      }
    }
  }

  if (propietarios_ids.length === 0) {
    migrationNotes.push('No owners found - property without owner');
  }

  // 4. Direccion con fallbacks por provincia
  const DEFAULT_LOCATIONS: Record<string, { state: string; city: string }> = {
    '26': { state: '26', city: '260112' },
    '06': { state: '6', city: '60441' },
    '6': { state: '6', city: '60441' },
    '02': { state: '2', city: '22084' },
    '2': { state: '2', city: '22084' },
  };

  const DEFAULT_STATE_ID = '26';
  const DEFAULT_CITY_ID = '260112';
  
  let stateId = legacyProperty.state?.id || DEFAULT_STATE_ID;
  let cityId = legacyProperty.city?.id || DEFAULT_CITY_ID;

  let provincia_id = provinceMap.get(stateId);
  let localidad_id = localityMap.get(cityId);

  // Fallback por provincia
  if (provincia_id && !localidad_id) {
    const defaultForProvince = DEFAULT_LOCATIONS[stateId];
    if (defaultForProvince) {
      cityId = defaultForProvince.city;
      localidad_id = localityMap.get(cityId);
      migrationNotes.push(`Default locality used for province ${stateId}`);
    }
  }

  // Fallback global
  if (!provincia_id || !localidad_id) {
    const defaultLocation = DEFAULT_LOCATIONS[DEFAULT_STATE_ID];
    stateId = defaultLocation.state;
    cityId = defaultLocation.city;
    provincia_id = provinceMap.get(stateId);
    localidad_id = localityMap.get(cityId);
    migrationNotes.push('Global default location used');
  }

  if (!provincia_id || !localidad_id) {
    logger.warning(`Property ${legacyProperty._id}: No se pudo mapear ubicación`);
    return null;
  }

  const direccion = {
    calle: legacyProperty.address || 'Sin dirección especificada',
    numero: '',
    piso_dpto: '',
    provincia_id,
    localidad_id,
    codigo_postal: '',
    latitud: null,
    longitud: null,
  };

  // 5. Características
  const dormitorios = extractDormitorios(legacyProperty.description);
  const banos = extractBanos(legacyProperty.description);

  const caracteristicas = {
    tipo_propiedad: 'departamento', // Por defecto
    dormitorios,
    banos,
    metraje_total: null,
    metraje_cubierto: null,
    antiguedad_anos: null,
    orientacion: null,
  };

  // 6. Servicios/Impuestos
  const servicios_impuestos = legacyProperty.associatedServices?.map(svc => {
    const proveedor_id = Validators.toObjectId(svc.serviceCompany._id);
    if (!proveedor_id) {
      migrationNotes.push(`Invalid service provider ID: ${svc.serviceCompany._id}`);
      return null;
    }

    return {
      proveedor_id,
      identificador_servicio: svc.id,
      porcentaje_aplicacion: svc.ratio,
      origen: PAYMENT_SOURCE_MAP[svc.paymentSource] || svc.paymentSource.toUpperCase(),
      destino: PAYMENT_TARGET_MAP[svc.paymentTarget] || svc.paymentTarget.toUpperCase(),
    };
  }).filter((svc): svc is NonNullable<typeof svc> => svc !== null) || [];

  // 7. Estado ocupacional y contrato
  const contrato_vigente_id = legacyProperty.leaseAgreement 
    ? Validators.toObjectId(legacyProperty.leaseAgreement) 
    : null;
  
  const estado_ocupacional = contrato_vigente_id ? 'ALQUILADA' : 'DISPONIBLE';

  // 8. Status
  const status = legacyProperty.active !== false ? 'DISPONIBLE' : 'INACTIVA';

  return {
    _id,
    propietarios_ids,
    identificador_interno,
    identificador_tributario: '',
    titulo: '',
    descripcion: '',
    direccion,
    caracteristicas,
    servicios_impuestos,
    consorcio_nombre: '',
    tipo_expensas: null,
    img_cover_url: '',
    valor_venta: null,
    valor_alquiler: null,
    publicar_para_venta: false,
    publicar_para_alquiler: false,
    proposito: 'VIVIENDA',
    status,
    estado_ocupacional,
    contrato_vigente_id,
    imagenes: [],
    usuario_creacion_id: null,
    _legacyLocationIds: legacyProperty.state || legacyProperty.city ? {
      state: legacyProperty.state,
      city: legacyProperty.city,
    } : undefined,
    _legacyData: {
      inventory: legacyProperty.inventory || [],
      description: legacyProperty.description || [],
      specs: legacyProperty.specs,
      createdAt: legacyProperty.createdAt,
    },
    _migrationNotes: migrationNotes,
  };
}

async function migrateProperties(options: { dryRun?: boolean; truncateFirst?: boolean } = {}) {
  logger.startPhase('FASE 2 - Migración de Propiedades');

  const { dryRun = false, truncateFirst = false } = options;

  if (dryRun) {
    logger.warning('⚠️  MODO DRY-RUN ACTIVADO');
  }

  if (truncateFirst) {
    logger.warning('⚠️  SE ELIMINARÁN TODAS LAS PROPIEDADES EXISTENTES EN V3');
  }

  try {
    const legacyDb = await dbConnections.getLegacyDB();
    const v3Db = await dbConnections.getV3DB();

    const legacyCollection = legacyDb.collection<LegacyProperty>('properties');
    const v3Collection = v3Db.collection<any>('properties');

    // Truncar si se indica
    if (truncateFirst && !dryRun) {
      await DbHelpers.truncateCollection(v3Db, 'properties');
    }

    // Cargar mapeos de provincias y localidades
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
      if (l.municipio && l.municipio.id) {
        localityMap.set(String(l.municipio.id), l._id);
      }
    });
    logger.success(`Localidades cargadas: ${localityMap.size}`);

    // Leer propiedades de Legacy
    logger.info('📖 Leyendo propiedades de Legacy...');
    const legacyProperties = await legacyCollection.find({}).toArray();
    logger.info(`Total de propiedades a migrar: ${legacyProperties.length}`);

    // Transformar propiedades
    logger.info('🔄 Transformando propiedades...');
    const v3Properties: V3Property[] = [];
    let skipped = 0;

    for (const legacyProperty of legacyProperties) {
      try {
        const v3Property = await transformProperty(legacyProperty, provinceMap, localityMap);
        if (v3Property) {
          v3Properties.push(v3Property);
        } else {
          skipped++;
        }
      } catch (error) {
        logger.error(`Error transformando propiedad ${legacyProperty._id}:`, error);
        skipped++;
      }
    }

    logger.success(`Propiedades transformadas: ${v3Properties.length}`);
    if (skipped > 0) {
      logger.warning(`Propiedades omitidas: ${skipped}`);
    }

    // Insertar en V3
    if (!dryRun) {
      logger.info('💾 Insertando propiedades en V3...');
      
      const stats = await DbHelpers.bulkInsertWithDuplicateHandling(
        v3Collection,
        v3Properties,
        { continueOnError: true },
      );

      logger.success(`Propiedades insertadas: ${stats.inserted}`);
      if (stats.duplicates > 0) {
        logger.warning(`Propiedades duplicadas (omitidas): ${stats.duplicates}`);
      }
      if (stats.errors.length > 0) {
        logger.error(`Errores durante inserción: ${stats.errors.length}`);
      }

      // Generar reportes
      logger.info('📄 Generando reportes JSON...');
      const fs = require('fs');
      const path = require('path');
      
      const reportDir = path.join(__dirname, '..', '..', 'validacion', 'reports');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const statsReport = {
        timestamp: new Date().toISOString(),
        fase: 'Fase 2 - Migración de Propiedades',
        estadisticas: {
          legacy: legacyProperties.length,
          transformados: v3Properties.length,
          omitidos: skipped,
          insertados: stats.inserted,
          duplicados: stats.duplicates,
          errores: stats.errors.length,
          tasa_exito: ((stats.inserted / legacyProperties.length) * 100).toFixed(2) + '%',
        },
      };
      
      const statsPath = path.join(reportDir, `migracion-properties-stats-${timestamp}.json`);
      fs.writeFileSync(statsPath, JSON.stringify(statsReport, null, 2));
      logger.success(`Reporte guardado: ${statsPath}`);

      logger.endPhase('FASE 2 - Migración de Propiedades', {
        legacy: legacyProperties.length,
        transformed: v3Properties.length,
        skipped,
        inserted: stats.inserted,
      });

    } else {
      logger.info('💾 [DRY-RUN] Se habrían insertado las propiedades en V3');
      logger.info(`Muestra (primeros 3):`);
      v3Properties.slice(0, 3).forEach(prop => {
        logger.info(JSON.stringify(prop, null, 2));
      });

      logger.endPhase('FASE 2 - Migración de Propiedades (DRY-RUN)', {
        legacy: legacyProperties.length,
        transformed: v3Properties.length,
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

  migrateProperties(options)
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Error fatal:', error);
      process.exit(1);
    });
}

export { migrateProperties };
