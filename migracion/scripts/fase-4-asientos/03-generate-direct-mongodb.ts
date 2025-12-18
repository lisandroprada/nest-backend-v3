import { MongoClient, ObjectId } from 'mongodb';
import { logger } from '../utils/logger';
import { DateTime } from 'luxon';

/**
 * FASE 4 - BYPASS DIRECTO A MONGODB
 * 
 * Este script genera asientos contables trabajando DIRECTAMENTE con MongoDB,
 * evitando el endpoint HTTP que tiene problemas con el filtro de status.
 * 
 * Genera asientos mes a mes (FULL_HISTORY) para TODOS los 862 contratos.
 */

interface Contract {
  _id: ObjectId;
  terminos_financieros: {
    monto_base_vigente: number;
    comision_administracion_porcentaje: number;
    indice_tipo: 'FIJO' | 'ICL' | 'IPC';
    honorarios_locador_porcentaje?: number;
    honorarios_locatario_porcentaje?: number;
    honorarios_locador_cuotas?: number;
    honorarios_locatario_cuotas?: number;
  };
  fecha_inicio: Date;
  fecha_final: Date;
  ajuste_programado?: Date;
  deposito_monto?: number;
  partes: Array<{
    agente_id: ObjectId;
    rol: string;
  }>;
}

// Cuentas contables (IDs hardcodeados del sistema)
const ACCOUNTS = {
  CXC_ALQ: new ObjectId('6920a0f0ce629c47ae5193fe'), // Cuenta por Cobrar - Alquileres
  CXP_LOC: new ObjectId('6920a0f0ce629c47ae5193ff'), // Cuenta por Pagar - Locador
  ING_HNR: new ObjectId('6920a0f0ce629c47ae519400'), // Ingresos - Honorarios
  PAS_DEP: new ObjectId('6920a0f0ce629c47ae519401'), // Pasivo - Depósitos
  ACT_FID: new ObjectId('6920a0f0ce629c47ae519402'), // Activo - Fiduciario
};

const roundToTwo = (n: number) => Math.round(n * 100) / 100;

async function generateAccountingEntries() {
  logger.startPhase('FASE 4 - Generación Directa de Asientos (MongoDB)');

  const mongoClient = await MongoClient.connect('mongodb://127.0.0.1:27017/nest-propietasV3');
  const db = mongoClient.db();

  try {
    // 1. Limpiar asientos existentes
    logger.info('🗑️  Eliminando asientos existentes...');
    const deleteResult = await db.collection('accountingentries').deleteMany({});
    logger.success(`✅ Eliminados ${deleteResult.deletedCount} asientos`);

    // 2. Obtener TODOS los contratos (sin filtro de status)
    logger.info('\n📊 Obteniendo contratos...');
    const contracts = await db.collection('contracts').find({}).toArray() as any[];
    logger.success(`✅ Obtenidos ${contracts.length} contratos`);

    // 3. Procesar cada contrato
    let totalGenerated = 0;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < contracts.length; i++) {
      const contract = contracts[i] as Contract;
      
      try {
        const asientos = await generateFullHistoryForContract(contract, db);
        
        if (asientos.length > 0) {
          await db.collection('accountingentries').insertMany(asientos);
          totalGenerated += asientos.length;
          successCount++;
          
          if ((i + 1) % 50 === 0) {
            logger.info(`📦 Progreso: ${i + 1}/${contracts.length} contratos - ${totalGenerated} asientos generados`);
          }
        }
      } catch (error: any) {
        failCount++;
        logger.error(`❌ Error en contrato ${contract._id}: ${error.message}`);
      }
    }

    logger.success(`\n✅ Completado!`);
    logger.info(`   Contratos procesados: ${contracts.length}`);
    logger.info(`   Exitosos: ${successCount}`);
    logger.info(`   Fallidos: ${failCount}`);
    logger.info(`   Total asientos generados: ${totalGenerated}`);

    logger.endPhase('FASE 4 - Generación Directa de Asientos', {
      total: contracts.length,
      success: successCount,
      failed: failCount,
      asientosGenerados: totalGenerated,
    });

  } finally {
    await mongoClient.close();
  }
}

async function generateFullHistoryForContract(contract: Contract, db: any): Promise<any[]> {
  const asientos: any[] = [];
  
  const {
    terminos_financieros,
    fecha_inicio,
    fecha_final,
    deposito_monto,
    partes,
  } = contract;

  const locador = partes.find(p => p.rol === 'LOCADOR');
  const locatario = partes.find(p => p.rol === 'LOCATARIO');

  if (!locador || !locatario) {
    return asientos; // Saltar contratos sin locador/locatario
  }

  const fechaInicio = DateTime.fromJSDate(fecha_inicio);
  const fechaFin = DateTime.fromJSDate(fecha_final);
  
  // Calcular meses totales del contrato
  const mesesContrato = Math.ceil(fechaFin.diff(fechaInicio, 'months').months);
  const montoBase = terminos_financieros.monto_base_vigente;
  const montoTotalContrato = mesesContrato * montoBase;
  const comisionPct = terminos_financieros.comision_administracion_porcentaje / 100;

  // ============================================================
  // 1. ASIENTOS MENSUALES DE ALQUILER
  // ============================================================
  let fechaActual = fechaInicio;
  let montoVigente = montoBase;

  while (fechaActual < fechaFin) {
    const fechaVencimiento = fechaActual.plus({ days: 10 }).toJSDate();
    const comision = roundToTwo(montoVigente * comisionPct);
    const creditoLocador = roundToTwo(montoVigente - comision);

    const partidas = [
      {
        cuenta_id: ACCOUNTS.CXC_ALQ,
        agente_id: locatario.agente_id,
        descripcion: 'Alquiler a cobrar',
        debe: montoVigente,
        haber: 0,
        monto_pagado_acumulado: 0,
        monto_liquidado: 0,
        es_iva_incluido: false,
        tasa_iva_aplicada: 0,
        monto_base_imponible: 0,
        monto_iva_calculado: 0,
      },
      {
        cuenta_id: ACCOUNTS.CXP_LOC,
        agente_id: locador.agente_id,
        descripcion: 'Alquiler a pagar al locador',
        debe: 0,
        haber: creditoLocador,
        monto_pagado_acumulado: 0,
        monto_liquidado: 0,
        es_iva_incluido: false,
        tasa_iva_aplicada: 0,
        monto_base_imponible: 0,
        monto_iva_calculado: 0,
      },
      {
        cuenta_id: ACCOUNTS.ING_HNR,
        agente_id: null,
        descripcion: 'Comisión administración',
        debe: 0,
        haber: comision,
        monto_pagado_acumulado: 0,
        monto_liquidado: 0,
        es_iva_incluido: false,
        tasa_iva_aplicada: 0,
        monto_base_imponible: 0,
        monto_iva_calculado: 0,
      },
    ];

    asientos.push({
      contrato_id: contract._id,
      tipo_asiento: 'Alquiler Mensual',
      fecha_imputacion: fechaActual.toJSDate(),
      fecha_vencimiento: fechaVencimiento,
      descripcion: `Alquiler ${fechaActual.toFormat('MM/yyyy')}`,
      partidas,
      monto_original: montoVigente,
      monto_actual: montoVigente,
      usuario_creacion_id: new ObjectId('000000000000000000000000'),
      usuario_modificacion_id: new ObjectId('000000000000000000000000'),
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { periodo: Math.ceil(fechaActual.diff(fechaInicio, 'months').months) + 1 },
    });

    fechaActual = fechaActual.plus({ months: 1 });
  }

  // ============================================================
  // 2. DEPÓSITO EN GARANTÍA (si existe)
  // ============================================================
  if (deposito_monto && deposito_monto > 0) {
    // ASIENTO 1: Cobro del depósito al locatario (fecha_inicio)
    asientos.push({
      contrato_id: contract._id,
      tipo_asiento: 'Deposito en Garantia - Cobro',
      fecha_imputacion: fecha_inicio,
      fecha_vencimiento: fecha_inicio,
      descripcion: 'Cobro de depósito en garantía al locatario',
      partidas: [
        {
          cuenta_id: ACCOUNTS.CXC_ALQ,
          agente_id: locatario.agente_id,
          descripcion: 'Depósito en garantía a cobrar al locatario',
          debe: deposito_monto,
          haber: 0,
          monto_pagado_acumulado: 0,
          monto_liquidado: 0,
          es_iva_incluido: false,
          tasa_iva_aplicada: 0,
          monto_base_imponible: 0,
          monto_iva_calculado: 0,
        },
        {
          cuenta_id: ACCOUNTS.ACT_FID,
          agente_id: null,
          descripcion: 'Ingreso de depósito en garantía a caja/banco fiduciaria',
          debe: 0,
          haber: deposito_monto,
          monto_pagado_acumulado: 0,
          monto_liquidado: 0,
          es_iva_incluido: false,
          tasa_iva_aplicada: 0,
          monto_base_imponible: 0,
          monto_iva_calculado: 0,
        },
      ],
      monto_original: deposito_monto,
      monto_actual: deposito_monto,
      usuario_creacion_id: new ObjectId('000000000000000000000000'),
      usuario_modificacion_id: new ObjectId('000000000000000000000000'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // ASIENTO 2: Devolución del depósito al locador (fecha_final)
    asientos.push({
      contrato_id: contract._id,
      tipo_asiento: 'Deposito en Garantia - Devolucion',
      fecha_imputacion: fecha_final,
      fecha_vencimiento: fecha_final,
      descripcion: 'Devolución de depósito en garantía al locador',
      partidas: [
        {
          cuenta_id: ACCOUNTS.ACT_FID,
          agente_id: null,
          descripcion: 'Egreso de depósito en garantía desde caja/banco',
          debe: deposito_monto,
          haber: 0,
          monto_pagado_acumulado: 0,
          monto_liquidado: 0,
          es_iva_incluido: false,
          tasa_iva_aplicada: 0,
          monto_base_imponible: 0,
          monto_iva_calculado: 0,
        },
        {
          cuenta_id: ACCOUNTS.PAS_DEP,
          agente_id: locador.agente_id,
          descripcion: 'Depósito en garantía a devolver al locador',
          debe: 0,
          haber: deposito_monto,
          monto_pagado_acumulado: 0,
          monto_liquidado: 0,
          es_iva_incluido: false,
          tasa_iva_aplicada: 0,
          monto_base_imponible: 0,
          monto_iva_calculado: 0,
        },
      ],
      monto_original: deposito_monto,
      monto_actual: deposito_monto,
      usuario_creacion_id: new ObjectId('000000000000000000000000'),
      usuario_modificacion_id: new ObjectId('000000000000000000000000'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // ============================================================
  // 3. HONORARIOS LOCADOR (distribuidos en cuotas)
  // ============================================================
  const porcentajeHonLocador = (terminos_financieros.honorarios_locador_porcentaje ?? 0) / 100;
  const cuotasLocador = terminos_financieros.honorarios_locador_cuotas ?? 1;
  
  if (porcentajeHonLocador > 0) {
    const montoTotalHonorarios = roundToTwo(montoTotalContrato * porcentajeHonLocador);
    const montoPorCuota = roundToTwo(montoTotalHonorarios / cuotasLocador);

    for (let i = 0; i < cuotasLocador; i++) {
      const fechaVenc = fechaInicio.plus({ months: i, days: 10 });

      asientos.push({
        contrato_id: contract._id,
        tipo_asiento: 'Honorarios Locador',
        fecha_imputacion: fechaInicio.plus({ months: i }).toJSDate(),
        fecha_vencimiento: fechaVenc.toJSDate(),
        descripcion: `Honorarios locador - Cuota ${i + 1}/${cuotasLocador}`,
        partidas: [
          {
            cuenta_id: ACCOUNTS.CXP_LOC,
            agente_id: locador.agente_id,
            descripcion: `Descuento honorarios locador - Cuota ${i + 1}`,
            debe: montoPorCuota,
            haber: 0,
            monto_pagado_acumulado: 0,
            monto_liquidado: 0,
            es_iva_incluido: false,
            tasa_iva_aplicada: 0,
            monto_base_imponible: 0,
            monto_iva_calculado: 0,
          },
          {
            cuenta_id: ACCOUNTS.ING_HNR,
            agente_id: null,
            descripcion: `Ingreso honorarios locador - Cuota ${i + 1}`,
            debe: 0,
            haber: montoPorCuota,
            monto_pagado_acumulado: 0,
            monto_liquidado: 0,
            es_iva_incluido: false,
            tasa_iva_aplicada: 0,
            monto_base_imponible: 0,
            monto_iva_calculado: 0,
          },
        ],
        monto_original: montoPorCuota,
        monto_actual: montoPorCuota,
        usuario_creacion_id: new ObjectId('000000000000000000000000'),
        usuario_modificacion_id: new ObjectId('000000000000000000000000'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // ============================================================
  // 4. HONORARIOS LOCATARIO (distribuidos en cuotas)
  // ============================================================
  const porcentajeHonLocatario = (terminos_financieros.honorarios_locatario_porcentaje ?? 0) / 100;
  const cuotasLocatario = terminos_financieros.honorarios_locatario_cuotas ?? 1;

  if (porcentajeHonLocatario > 0) {
    const montoTotalHonorarios = roundToTwo(montoTotalContrato * porcentajeHonLocatario);
    const montoPorCuota = roundToTwo(montoTotalHonorarios / cuotasLocatario);

    for (let i = 0; i < cuotasLocatario; i++) {
      const fechaVenc = fechaInicio.plus({ months: i, days: 10 });

      asientos.push({
        contrato_id: contract._id,
        tipo_asiento: 'Honorarios Locatario',
        fecha_imputacion: fechaInicio.plus({ months: i }).toJSDate(),
        fecha_vencimiento: fechaVenc.toJSDate(),
        descripcion: `Honorarios locatario - Cuota ${i + 1}/${cuotasLocatario}`,
        partidas: [
          {
            cuenta_id: ACCOUNTS.CXC_ALQ,
            agente_id: locatario.agente_id,
            descripcion: `Cobro honorarios locatario - Cuota ${i + 1}`,
            debe: montoPorCuota,
            haber: 0,
            monto_pagado_acumulado: 0,
            monto_liquidado: 0,
            es_iva_incluido: false,
            tasa_iva_aplicada: 0,
            monto_base_imponible: 0,
            monto_iva_calculado: 0,
          },
          {
            cuenta_id: ACCOUNTS.ING_HNR,
            agente_id: null,
            descripcion: `Ingreso honorarios locatario - Cuota ${i + 1}`,
            debe: 0,
            haber: montoPorCuota,
            monto_pagado_acumulado: 0,
            monto_liquidado: 0,
            es_iva_incluido: false,
            tasa_iva_aplicada: 0,
            monto_base_imponible: 0,
            monto_iva_calculado: 0,
          },
        ],
        monto_original: montoPorCuota,
        monto_actual: montoPorCuota,
        usuario_creacion_id: new ObjectId('000000000000000000000000'),
        usuario_modificacion_id: new ObjectId('000000000000000000000000'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return asientos;
}

if (require.main === module) {
  generateAccountingEntries()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Error fatal:', error);
      process.exit(1);
    });
}

export { generateAccountingEntries };
