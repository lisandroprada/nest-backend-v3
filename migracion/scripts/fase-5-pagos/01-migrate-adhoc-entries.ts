
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
const path = require('path');

// ===== CONFIGURACIÓN =====
const LEGACY_DB = 'mongodb://127.0.0.1:27017/propietas';
const V3_DB = 'mongodb://127.0.0.1:27017/nest-propietasV3';
const MIGRATION_USER_ID = new ObjectId('602b3588d9c61b619f0c61b2');

// Mapeo Ad-Hoc (Debe coincidir con MAPPING_TABLE.md)
const AD_HOC_MAP: Record<string, { tipoAsiento: string, cuentaCod: string }> = {
  'Factura de Servicios': { tipoAsiento: 'Pago de Servicios', cuentaCod: 'CXC_SERVICIOS' },
  'Expensas': { tipoAsiento: 'Pago de Expensas', cuentaCod: 'CXC_SERVICIOS' },
  'Expensas Extraordinarias': { tipoAsiento: 'Pago de Expensas', cuentaCod: 'CXC_SERVICIOS' },
  'Cargo proveedor': { tipoAsiento: 'Gasto Proveedor', cuentaCod: 'CXP_SERVICIOS' },
  'Interés': { tipoAsiento: 'Interes por Mora', cuentaCod: 'ING_INT_MORA' },
  'Bonificación': { tipoAsiento: 'Nota de Credito', cuentaCod: 'EGR_AJU' }
};

// IDs de Cuentas (Hardcoded para velocidad, idealmente buscar en DB)
const CHART_IDS: Record<string, ObjectId> = {
  CXC_SERVICIOS: new ObjectId('6920a0f0ce629c47ae519400'),
  CXP_SERVICIOS: new ObjectId('6920a0f0ce629c47ae519401'),
  ING_INT_MORA: new ObjectId('68f59e24853d3916c9f78c0b'),
  EGR_AJU: new ObjectId('69092a2b384cbd332489d732')
};

async function migrateAdHocEntries() {
  console.log('🚀 Iniciando Fase 4.5: Migración de Asientos Ad-Hoc...');
  
  const legacyConn = await mongoose.createConnection(LEGACY_DB).asPromise();
  const v3Conn = await mongoose.createConnection(V3_DB).asPromise();
  
  try {
    const legacyDb = legacyConn.db;
    const v3Db = v3Conn.db;

    // 1. Obtener asientos legacy de tipos ad-hoc desde MASTERACCOUNTS
    const adHocTypes = Object.keys(AD_HOC_MAP);
    console.log(`🔍 Buscando tipos: ${adHocTypes.join(', ')}`);
    
    const cursor = legacyDb.collection('masteraccounts').find({ 
        type: { $in: adHocTypes } 
    });
    
    const entriesToMigrate = await cursor.toArray();
    
    console.log(`📋 Encontrados ${entriesToMigrate.length} masteraccounts candidatos.`);

    let successes = 0;
    
    for (const legacyEntry of entriesToMigrate) {
        const conf = AD_HOC_MAP[legacyEntry.type as string];
        if (!conf) continue; 

        // Generar AccountingEntry V3
        const cuentaId = CHART_IDS[conf.cuentaCod];
        if (!cuentaId) { console.warn(`Skipping ${conf.cuentaCod} unknown`); continue; }
        
        const amount = Math.abs(legacyEntry.amount || 0);
        
        // Mapeo simple de campos
        // Metadatos cruciales: legacy_id pointing to masteraccounts._id
        const newEntry = {
            _id: new ObjectId(),
            contrato_id: null, // No tenemos contrato directo en masteraccount, se deja null (Ad-Hoc legal)
            fecha_imputacion: legacyEntry.date || new Date(),
            fecha_vencimiento: legacyEntry.dueDate || legacyEntry.date || new Date(),
            descripcion: legacyEntry.description || conf.tipoAsiento,
            tipo_asiento: conf.tipoAsiento,
            estado: 'PENDIENTE',
            monto_original: amount,
            monto_actual: amount,
            es_ajustable: false,
            usuario_creacion_id: MIGRATION_USER_ID,
            createdAt: new Date(), updatedAt: new Date(),
            metadata: {
                legacy_id: legacyEntry._id, 
                legacy_src: 'masteraccounts',
                legacy_type: legacyEntry.type
            },
            partidas: [
                {
                    cuenta_id: cuentaId,
                    descripcion: conf.tipoAsiento,
                    debe: amount, 
                    haber: 0,
                    agente_id: legacyEntry.target ? new ObjectId(legacyEntry.target._id) : null, // Target suele ser el deudor en CXC
                    monto_pagado_acumulado: 0,
                    monto_liquidado: 0,
                    es_iva_incluido: false,
                    monto_base_imponible: amount,
                    monto_iva_calculado: 0
                },
                {
                    cuenta_id: new ObjectId('68de7db05ef4c4702a92debc'),
                    descripcion: 'Contrapartida Migración',
                    debe: 0,
                    haber: amount
                }
            ]
        };

        if (conf.cuentaCod === 'ING_INT_MORA') {
            newEntry.partidas[0].debe = 0;
            newEntry.partidas[0].haber = amount;
            newEntry.partidas[1].debe = amount; 
            newEntry.partidas[1].haber = 0;
        }

        
        // Insertar
        await v3Db.collection('accountingentries').insertOne(newEntry as any);
        successes++;
    }
    
    console.log(`✅ Fase 4.5 Completada. Migrados ${successes} asientos Ad-Hoc.`);

  } catch (error) {
    console.error('❌ Error fatal:', error);
  } finally {
    await legacyConn.close();
    await v3Conn.close();
  }
}

migrateAdHocEntries();
