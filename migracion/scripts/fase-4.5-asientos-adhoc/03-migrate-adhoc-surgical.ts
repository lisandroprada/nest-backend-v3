
import { MongoClient, ObjectId } from 'mongodb';
import { dbConnections } from '../../configuracion/conexiones.config';
import { logger } from '../utils/logger';

/**
 * FASE 4.5 - Migración Quirúrgica Asientos Ad-Hoc (Retamosa)
 */

const ACCOUNT_MAPPING: Record<string, { debe: string, haber: string, tipoAsiento: string }> = {
  'Cargo proveedor': { 
    debe: 'GTO_REP', 
    haber: 'CXP_PRO', 
    tipoAsiento: 'Gasto Proveedor' 
  },
  'Factura de Servicios': {
    debe: 'CXC_SER',
    haber: 'CXP_SER',
    tipoAsiento: 'Pago de Servicios'
  }
};

async function migrateAdHocSurgical() {
  logger.startPhase('FASE 4.5 (Quirúrgica) - Migración Asientos Ad-Hoc - Locador');

  let legacyClient: MongoClient | null = null;
  let v3Client: MongoClient | null = null;

  try {
    legacyClient = await dbConnections.connectToLegacy();
    v3Client = await dbConnections.connectToV3();
    
    const legacyDb = legacyClient.db();
    const v3Db = v3Client.db();

    const chartOfAccounts = await v3Db.collection('chartofaccounts').find({}).toArray();
    const accountsMap = new Map<string, ObjectId>();
    chartOfAccounts.forEach(acc => {
      if (acc.codigo) accountsMap.set(acc.codigo, acc._id);
    });

    // FOCO QUIRÚRGICO: Retamosa y sus cuentas específicas
    const RETAMOSA_ID = new ObjectId("68fb7409bbb2614a30d98355");
    const TARGET_CONTRACT_ID = new ObjectId("6902560abbb2614a30d9d131");
    const SPECIFIC_ACCOUNT_IDS = [
        "6908a121bbb2614a30d9ef8b", 
        "6904e0cabbb2614a30d9e8b4", 
        "693ab634c791044841ae7d74", 
        "693ad300c791044841ae85ca"
    ].map(id => new ObjectId(id));

    logger.info(`🔍 Buscando movimientos Ad-Hoc específicos para Retamosa...`);
    
    // Buscar por IDs directos para asegurar puntería
    const legacyAccounts = await legacyDb.collection('accounts').find({
      _id: { $in: SPECIFIC_ACCOUNT_IDS }
    }).toArray();

    logger.info(`   Encontradas ${legacyAccounts.length} cuentas.`);

    const masterIds = legacyAccounts.map(a => a.masterAccount);
    const masterAccounts = await legacyDb.collection('masteraccounts').find({
      _id: { $in: masterIds }
    }).toArray();

    const bulkOps: any[] = [];

    for (const legAcc of legacyAccounts) {
        const master = masterAccounts.find(m => m._id.toString() === legAcc.masterAccount.toString());
        if (!master) continue;

        const mapping = ACCOUNT_MAPPING[master.type] || ACCOUNT_MAPPING['Cargo proveedor'];
        const debeId = accountsMap.get(mapping.debe);
        const haberId = accountsMap.get(mapping.haber);

        const newEntry = {
          _id: legAcc._id,
          contrato_id: TARGET_CONTRACT_ID,
          tipo_asiento: mapping.tipoAsiento,
          fecha_imputacion: legAcc.date || master.date,
          fecha_vencimiento: legAcc.dueDate || master.dueDate,
          descripcion: legAcc.accountDescription || master.description,
          estado: 'PENDIENTE',
          monto_original: legAcc.amount,
          monto_actual: legAcc.amount,
          es_ajustable: false,
          partidas: [
            {
              cuenta_id: debeId || new ObjectId(),
              descripcion: legAcc.accountDescription || mapping.tipoAsiento,
              debe: legAcc.amount,
              haber: 0,
              agente_id: RETAMOSA_ID, // El que debe (Locador)
              monto_pagado_acumulado: 0
            },
            {
              cuenta_id: haberId || new ObjectId(),
              descripcion: legAcc.accountDescription || mapping.tipoAsiento,
              debe: 0,
              haber: legAcc.amount,
              agente_id: null,
              monto_liquidado: 0
            }
          ],
          metadata: {
            legacy_id: legAcc._id,
            legacy_master_id: master._id,
            legacy_type: master.type,
            migrated_at: new Date(),
            quirurgico: true
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };

        bulkOps.push({
          updateOne: {
            filter: { _id: newEntry._id },
            update: { $set: newEntry },
            upsert: true
          }
        });
    }

    if (bulkOps.length > 0) {
      logger.info(`💾 Guardando ${bulkOps.length} asientos ad-hoc en V3...`);
      const res = await v3Db.collection('accountingentries').bulkWrite(bulkOps);
      logger.success(`✅ Operación completada.`);
    }

    logger.endPhase('FASE 4.5 (Quirúrgica) - Completada');

  } catch (error) {
    logger.error('Error fatal', error);
  } finally {
    if (legacyClient) await legacyClient.close();
    if (v3Client) await v3Client.close();
  }
}

migrateAdHocSurgical();
