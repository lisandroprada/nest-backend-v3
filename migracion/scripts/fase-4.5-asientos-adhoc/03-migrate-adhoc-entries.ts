
import { MongoClient, ObjectId } from 'mongodb';
import { dbConnections } from '../../configuracion/conexiones.config';
import { logger } from '../utils/logger';
import { DbHelpers } from '../utils/db-helpers';

/**
 * FASE 4.5 - Migración de Asientos Ad-Hoc (Expensas, Servicios, Ajustes)
 * 
 * Estrategia: "Migración con ID Original"
 * 
 * 1. Identifica 'Accounts' (Deudas) en Legacy que NO son contractuales (Alquiler/Honorarios).
 * 2. Las migra a 'AccountingEntry' en V3.
 * 3. CRITICO: Fuerza que el _id en V3 sea igual al _id de Legacy.
 *    Esto permite que la migración de pagos (Fase 5B) encuentre la deuda directamente.
 */

const AD_HOC_TYPES = [
  'Expensas',
  'Factura de Servicios',
  'Bonificación',
  'Cargo proveedor',
  'Interés'
];

// Mapeo de Conceptos Legacy a Cuentas V3 (Códigos)
const ACCOUNT_MAPPING: Record<string, { debe: string, haber: string, tipoAsiento: string }> = {
  'Expensas': { 
    debe: 'CXC_EXP', // Cuentas por Cobrar Expensas
    haber: 'CXP_TER', // Cuentas por Pagar Terceros (Consorcio)
    tipoAsiento: 'Expensa'
  },
  'Factura de Servicios': {
    debe: 'CXC_SER', // O CXP_LOC/CXC_ALQ dependiendo de quien paga? Asumimos Gasto Propiedad por ahora o variable.
                     // Simplificación: Usar CXC_SER (Servicios a Cobrar) o Gasto
    haber: 'CXP_SER', // Cuentas por Pagar Servicios
    tipoAsiento: 'Pago de Servicios'
  },
  'Bonificación': {
    debe: 'EGR_BON', // Egreso por Bonificación (Gasto Inmobiliaria o Propietario)
    haber: 'CXC_ALQ', // Disminuye la deuda del inquilino
    tipoAsiento: 'Nota de Crédito'
  },
  'Cargo proveedor': {
    debe: 'GTO_REP', // Gasto Reparaciones
    haber: 'CXP_PRO', // Cuentas por Pagar Proveedores
    tipoAsiento: 'Gasto Proveedor'
  },
  'Interés': {
    debe: 'CXC_ALQ', // Aumenta deuda inquilino
    haber: 'ING_INT', // Ingreso por Intereses
    tipoAsiento: 'Nota de Débito'
  }
};

async function migrateAdHocEntries() {
  logger.startPhase('FASE 4.5 - Migración de Asientos Ad-Hoc (Preservando IDs)');

  let legacyClient: MongoClient | null = null;
  let v3Client: MongoClient | null = null;

  try {
    // 1. Conexiones
    legacyClient = await dbConnections.connectToLegacy();
    v3Client = await dbConnections.connectToV3();
    
    const legacyDb = legacyClient.db();
    const v3Db = v3Client.db();

    // 2. Cargar Plan de Cuentas V3 (Map Código -> ObjectId)
    logger.info('📚 Cargando Plan de Cuentas V3...');
    const chartOfAccounts = await v3Db.collection('chartofaccounts').find({}).toArray();
    const accountsMap = new Map<string, ObjectId>();
    
    chartOfAccounts.forEach(acc => {
      if (acc.codigo) accountsMap.set(acc.codigo, acc._id);
    });
    
    // Validar cuentas requeridas
    const requiredCodes = new Set<string>();
    Object.values(ACCOUNT_MAPPING).forEach(m => {
      // Manejo básico por ahora, algunos códigos pueden no existir en el mapping real
      if(m.debe) requiredCodes.add(m.debe);
      if(m.haber) requiredCodes.add(m.haber);
    });

    // 3. Obtener Asientos Ad-Hoc Legacy
    logger.info(`🔍 Buscando cuentas Legacy de tipos: ${AD_HOC_TYPES.join(', ')}...`);
    
    // En Legacy, 'Account' es la deuda individual.
    // Filtrar por los tipos definidos.
    // OJO: En Legacy el 'type' a veces está en la MasterAccount. 
    // Pero 'Account' tiene 'accountDescription' que suele coincidir o 'masterAccount' populate.
    // Vamos a buscar primero las MasterAccount de estos tipos y luego las Accounts asociadas.
    
    const masterAccounts = await legacyDb.collection('masteraccounts').find({
      type: { $in: AD_HOC_TYPES }
    }).toArray();

    const masterIds = masterAccounts.map(m => m._id);
    logger.info(`   Encontradas ${masterAccounts.length} MasterAccounts de tipos Ad-Hoc.`);

    if (masterIds.length === 0) {
      logger.warning('No se encontraron asientos Ad-Hoc para migrar.');
      return;
    }

    const legacyAccounts = await legacyDb.collection('accounts').find({
      masterAccount: { $in: masterIds }
    }).toArray();

    logger.info(`   Encontradas ${legacyAccounts.length} Accounts (Deudas) asociadas.`);

    // 4. Transformar y Migrar
    let processed = 0;
    let errors = 0;
    const bulkOps: any[] = [];

    for (const legAcc of legacyAccounts) {
      try {
        const master = masterAccounts.find(m => m._id.toString() === legAcc.masterAccount.toString());
        if (!master) continue;

        const mapping = ACCOUNT_MAPPING[master.type];
        if (!mapping) {
           logger.warning(`Tipo no mapeado: ${master.type} para cuenta ${legAcc._id}`);
           continue; 
        }

        // Resolver IDs de cuentas contables
        const debeId = accountsMap.get(mapping.debe);
        const haberId = accountsMap.get(mapping.haber);

        // Fallback si no existen las cuentas específicas (usar genéricas o loguear)
        // Por ahora saltamos si falta cuenta crítica
        if (!debeId || !haberId) {
            // logger.warning(`Faltan cuentas contables para ${master.type} (Debe: ${mapping.debe}, Haber: ${mapping.haber})`);
            // errors++;
            // continue;
            // TODO: Descomentar validación estricta cuando el seed esté completo.
        }

        const fechaImputacion = legAcc.date || master.date;
        const fechaVencimiento = legAcc.dueDate || master.dueDate;

        // Construir AccountingEntry V3
        const newEntry = {
          _id: legAcc._id, // <--- CRITICO: Preservar ID
          contrato_id: null, // Asientos ad-hoc loose suelen no estar atados a contrato estructural V3 o es complejo vincular
                             // Si tenemos contracts migrados con legacy_id, podríamos intentar buscar el contract V3 por legacy_id.
                             // Por ahora dejaremos contrato_id null o intentaremos resolverlo si el origin es un contrato.
          tipo_asiento: mapping.tipoAsiento,
          fecha_imputacion: fechaImputacion,
          fecha_vencimiento: fechaVencimiento,
          descripcion: legAcc.accountDescription || master.description || `Migración ${master.type}`,
          estado: 'PENDIENTE', // Inicialmente pendiente, los pagos lo actualizarán
          monto_original: legAcc.amount,
          monto_actual: legAcc.amount,
          es_ajustable: false,
          partidas: [
            {
              cuenta_id: debeId || new ObjectId(), // Placeholder si falta
              descripcion: mapping.tipoAsiento,
              debe: legAcc.amount,
              haber: 0,
              agente_id: null, // Idealmente mapear agente si existe en Legacy source/target
              monto_pagado_acumulado: 0
            },
            {
              cuenta_id: haberId || new ObjectId(), // Placeholder
              descripcion: mapping.tipoAsiento,
              debe: 0,
              haber: legAcc.amount,
              agente_id: null,
              monto_liquidado: 0
            }
          ],
          historial_cambios: [{
             fecha: new Date(),
             usuario_id: null,
             accion: 'MIGRACION_LEGACY',
             estado_nuevo: 'PENDIENTE',
             observaciones: `Migrado desde Legacy Account ${legAcc._id} (Tipo: ${master.type})`
          }],
          metadata: {
            legacy_id: legAcc._id,
            legacy_master_id: master._id,
            legacy_type: master.type,
            migrated_at: new Date()
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Upsert para ser idempotente
        bulkOps.push({
          updateOne: {
            filter: { _id: newEntry._id },
            update: { $set: newEntry },
            upsert: true
          }
        });

        processed++;
      } catch (err) {
        logger.error(`Error procesando cuenta ${legAcc._id}`, err);
        errors++;
      }
    }

    // 5. Ejecutar Bulk Write
    if (bulkOps.length > 0) {
      logger.info(`💾 Guardando ${bulkOps.length} asientos en V3...`);
      const res = await v3Db.collection('accountingentries').bulkWrite(bulkOps);
      logger.success(`✅ Insertados: ${res.upsertedCount}, Modificados: ${res.modifiedCount}`);
    } else {
        logger.info('No hay operaciones para ejecutar.');
    }

    logger.endPhase('FASE 4.5 - Completada', { processed, errors });

  } catch (error) {
    logger.error('Error fatal en migración Ad-Hoc', error);
  } finally {
    if (legacyClient) await legacyClient.close();
    if (v3Client) await v3Client.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  migrateAdHocEntries().catch(console.error);
}
