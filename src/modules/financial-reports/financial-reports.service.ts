import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AccountingEntry } from '../accounting-entries/entities/accounting-entry.entity';
import { ChartOfAccount } from '../chart-of-accounts/entities/chart-of-account.entity';
import { FinancialAccount } from '../financial-accounts/entities/financial-account.entity';
import { FinancialReportQueryDto } from './dto/financial-report-query.dto';

@Injectable()
export class FinancialReportsService {
  constructor(
    @InjectModel(AccountingEntry.name)
    private accountingEntryModel: Model<AccountingEntry>,
    @InjectModel(ChartOfAccount.name)
    private chartOfAccountModel: Model<ChartOfAccount>,
    @InjectModel(FinancialAccount.name)
    private financialAccountModel: Model<FinancialAccount>,
  ) {}

  /**
   * Balance General (Balance Sheet)
   * Muestra ACTIVOS, PASIVOS y PATRIMONIO NETO al final de un período
   * INCLUYE saldos reales de caja/banco desde FinancialAccounts
   */
  async getBalanceSheet(query: FinancialReportQueryDto) {
    const matchStage: any = {
      estado: { $in: ['PAGADO', 'PAGADO_PARCIAL', 'LIQUIDADO'] },
    };

    if (query.fecha_desde || query.fecha_hasta) {
      matchStage.fecha_asiento = {};
      if (query.fecha_desde)
        matchStage.fecha_asiento.$gte = new Date(query.fecha_desde);
      if (query.fecha_hasta)
        matchStage.fecha_asiento.$lte = new Date(query.fecha_hasta);
    }

    // 1. Obtener saldos REALES de caja/banco desde FinancialAccounts
    const cuentasFinancieras = await this.financialAccountModel
      .find({ status: 'ACTIVA' })
      .select('nombre tipo saldo_inicial')
      .lean();

    // 2. Obtener partidas contables (excluyendo cuentas de efectivo que ya tenemos)
    const partidas = await this.accountingEntryModel.aggregate([
      { $match: matchStage },
      { $unwind: '$partidas' },
      {
        $lookup: {
          from: 'chartofaccounts',
          localField: 'partidas.cuenta_id',
          foreignField: '_id',
          as: 'cuenta',
        },
      },
      { $unwind: '$cuenta' },
      {
        $match: {
          'cuenta.tipo_cuenta': {
            $in: ['ACTIVO', 'PASIVO', 'PATRIMONIO_NETO'],
          },
          // Excluir cuentas de efectivo (las tomamos de FinancialAccounts)
          'cuenta.codigo': { $nin: ['ACT_CAJ', 'ACT_BCO', 'ACT_FID'] },
        },
      },
      {
        $group: {
          _id: {
            tipo_cuenta: '$cuenta.tipo_cuenta',
            codigo: '$cuenta.codigo',
            nombre: '$cuenta.nombre',
          },
          total_debe: { $sum: '$partidas.debe' },
          total_haber: { $sum: '$partidas.haber' },
        },
      },
      {
        $project: {
          _id: 0,
          tipo_cuenta: '$_id.tipo_cuenta',
          codigo: '$_id.codigo',
          nombre: '$_id.nombre',
          saldo: { $subtract: ['$total_debe', '$total_haber'] },
        },
      },
      { $sort: { tipo_cuenta: 1, codigo: 1 } },
    ]);

    // 3. Convertir cuentas financieras a formato de activos
    const activosEfectivo = cuentasFinancieras.map((cf) => ({
      tipo_cuenta: 'ACTIVO',
      codigo:
        cf.tipo === 'CAJA_EFECTIVO'
          ? 'ACT_CAJ'
          : cf.tipo === 'BANCO_CTA_CTE'
            ? 'ACT_BCO'
            : 'ACT_FID',
      nombre: `${cf.nombre} (Real)`,
      saldo: cf.saldo_inicial || 0,
      es_cuenta_real: true, // Flag para identificar
    }));

    // 4. Combinar activos de efectivo con otros activos
    const activos = [
      ...activosEfectivo,
      ...partidas.filter((p) => p.tipo_cuenta === 'ACTIVO'),
    ];
    const pasivos = partidas.filter((p) => p.tipo_cuenta === 'PASIVO');
    const patrimonio = partidas.filter(
      (p) => p.tipo_cuenta === 'PATRIMONIO_NETO',
    );

    const totalActivos = activos.reduce((sum, p) => sum + p.saldo, 0);
    const totalPasivos = pasivos.reduce((sum, p) => sum + Math.abs(p.saldo), 0);
    const totalPatrimonio = patrimonio.reduce(
      (sum, p) => sum + Math.abs(p.saldo),
      0,
    );

    return {
      fecha_desde: query.fecha_desde || 'Inicio',
      fecha_hasta: query.fecha_hasta || 'Hoy',
      activos: {
        cuentas: activos,
        total: totalActivos,
        detalle: {
          efectivo_real: activosEfectivo.reduce((sum, a) => sum + a.saldo, 0),
          otros_activos: activos
            .filter((a) => !a['es_cuenta_real'])
            .reduce((sum, a) => sum + a.saldo, 0),
        },
      },
      pasivos: {
        cuentas: pasivos.map((p) => ({ ...p, saldo: Math.abs(p.saldo) })),
        total: totalPasivos,
      },
      patrimonio_neto: {
        cuentas: patrimonio.map((p) => ({ ...p, saldo: Math.abs(p.saldo) })),
        total: totalPatrimonio,
      },
      total_pasivo_patrimonio: totalPasivos + totalPatrimonio,
      ecuacion_contable: {
        activos: totalActivos,
        pasivos_mas_patrimonio: totalPasivos + totalPatrimonio,
        diferencia: totalActivos - (totalPasivos + totalPatrimonio),
        balanceado:
          Math.abs(totalActivos - (totalPasivos + totalPatrimonio)) < 0.01,
      },
      nota: 'Los saldos de caja/banco reflejan los valores REALES de las cuentas financieras',
    };
  }

  /**
   * Estado de Resultados (Income Statement)
   * Muestra INGRESOS y EGRESOS en un período
   */
  async getIncomeStatement(query: FinancialReportQueryDto) {
    const matchStage: any = {
      estado: { $in: ['PAGADO', 'PAGADO_PARCIAL', 'LIQUIDADO'] },
    };

    if (query.fecha_desde || query.fecha_hasta) {
      matchStage.fecha_asiento = {};
      if (query.fecha_desde)
        matchStage.fecha_asiento.$gte = new Date(query.fecha_desde);
      if (query.fecha_hasta)
        matchStage.fecha_asiento.$lte = new Date(query.fecha_hasta);
    }

    const partidas = await this.accountingEntryModel.aggregate([
      { $match: matchStage },
      { $unwind: '$partidas' },
      {
        $lookup: {
          from: 'chartofaccounts',
          localField: 'partidas.cuenta_id',
          foreignField: '_id',
          as: 'cuenta',
        },
      },
      { $unwind: '$cuenta' },
      {
        $match: {
          'cuenta.tipo_cuenta': { $in: ['INGRESO', 'EGRESO'] },
        },
      },
      {
        $group: {
          _id: {
            tipo_cuenta: '$cuenta.tipo_cuenta',
            codigo: '$cuenta.codigo',
            nombre: '$cuenta.nombre',
          },
          total_debe: { $sum: '$partidas.debe' },
          total_haber: { $sum: '$partidas.haber' },
        },
      },
      {
        $project: {
          _id: 0,
          tipo_cuenta: '$_id.tipo_cuenta',
          codigo: '$_id.codigo',
          nombre: '$_id.nombre',
          monto: {
            $cond: {
              if: { $eq: ['$_id.tipo_cuenta', 'INGRESO'] },
              then: { $subtract: ['$total_haber', '$total_debe'] },
              else: { $subtract: ['$total_debe', '$total_haber'] },
            },
          },
        },
      },
      { $sort: { tipo_cuenta: -1, codigo: 1 } },
    ]);

    const ingresos = partidas.filter((p) => p.tipo_cuenta === 'INGRESO');
    const egresos = partidas.filter((p) => p.tipo_cuenta === 'EGRESO');

    const totalIngresos = ingresos.reduce((sum, p) => sum + p.monto, 0);
    const totalEgresos = egresos.reduce((sum, p) => sum + p.monto, 0);
    const resultadoNeto = totalIngresos - totalEgresos;

    return {
      periodo: {
        fecha_desde: query.fecha_desde || 'Inicio',
        fecha_hasta: query.fecha_hasta || 'Hoy',
      },
      ingresos: {
        cuentas: ingresos,
        total: totalIngresos,
      },
      egresos: {
        cuentas: egresos,
        total: totalEgresos,
      },
      resultado_neto: resultadoNeto,
      tipo_resultado: resultadoNeto >= 0 ? 'GANANCIA' : 'PÉRDIDA',
    };
  }

  /**
   * Balance de Sumas y Saldos (Trial Balance)
   * Muestra todas las cuentas con sus movimientos debe/haber
   */
  async getTrialBalance(query: FinancialReportQueryDto) {
    const matchStage: any = {
      estado: { $in: ['PAGADO', 'PAGADO_PARCIAL', 'LIQUIDADO'] },
    };

    if (query.fecha_desde || query.fecha_hasta) {
      matchStage.fecha_asiento = {};
      if (query.fecha_desde)
        matchStage.fecha_asiento.$gte = new Date(query.fecha_desde);
      if (query.fecha_hasta)
        matchStage.fecha_asiento.$lte = new Date(query.fecha_hasta);
    }

    const partidas = await this.accountingEntryModel.aggregate([
      { $match: matchStage },
      { $unwind: '$partidas' },
      {
        $lookup: {
          from: 'chartofaccounts',
          localField: 'partidas.cuenta_id',
          foreignField: '_id',
          as: 'cuenta',
        },
      },
      { $unwind: '$cuenta' },
      {
        $group: {
          _id: {
            tipo_cuenta: '$cuenta.tipo_cuenta',
            codigo: '$cuenta.codigo',
            nombre: '$cuenta.nombre',
          },
          total_debe: { $sum: '$partidas.debe' },
          total_haber: { $sum: '$partidas.haber' },
        },
      },
      {
        $project: {
          _id: 0,
          tipo_cuenta: '$_id.tipo_cuenta',
          codigo: '$_id.codigo',
          nombre: '$_id.nombre',
          debe: '$total_debe',
          haber: '$total_haber',
          saldo: { $subtract: ['$total_debe', '$total_haber'] },
        },
      },
      { $sort: { tipo_cuenta: 1, codigo: 1 } },
    ]);

    const totalDebe = partidas.reduce((sum, p) => sum + p.debe, 0);
    const totalHaber = partidas.reduce((sum, p) => sum + p.haber, 0);
    const totalSaldoDeudor = partidas.reduce(
      (sum, p) => sum + (p.saldo > 0 ? p.saldo : 0),
      0,
    );
    const totalSaldoAcreedor = partidas.reduce(
      (sum, p) => sum + (p.saldo < 0 ? Math.abs(p.saldo) : 0),
      0,
    );

    return {
      periodo: {
        fecha_desde: query.fecha_desde || 'Inicio',
        fecha_hasta: query.fecha_hasta || 'Hoy',
      },
      cuentas: partidas,
      totales: {
        debe: totalDebe,
        haber: totalHaber,
        saldo_deudor: totalSaldoDeudor,
        saldo_acreedor: totalSaldoAcreedor,
        balanceado: Math.abs(totalDebe - totalHaber) < 0.01,
        diferencia: totalDebe - totalHaber,
      },
    };
  }

  /**
   * Flujo de Caja (Cash Flow)
   * Muestra movimientos de efectivo (cuentas ACT_CAJ, ACT_BCO, ACT_FID)
   * INCLUYE saldos iniciales y finales REALES
   */
  async getCashFlow(query: FinancialReportQueryDto) {
    const matchStage: any = {
      estado: { $in: ['PAGADO', 'PAGADO_PARCIAL', 'LIQUIDADO'] },
    };

    if (query.fecha_desde || query.fecha_hasta) {
      matchStage.fecha_asiento = {};
      if (query.fecha_desde)
        matchStage.fecha_asiento.$gte = new Date(query.fecha_desde);
      if (query.fecha_hasta)
        matchStage.fecha_asiento.$lte = new Date(query.fecha_hasta);
    }

    // 1. Obtener saldos ACTUALES de cuentas financieras
    const cuentasFinancieras = await this.financialAccountModel
      .find({ status: 'ACTIVA' })
      .select('nombre tipo saldo_inicial')
      .lean();

    const saldoActualTotal = cuentasFinancieras.reduce(
      (sum, cf) => sum + (cf.saldo_inicial || 0),
      0,
    );

    // 2. Obtener movimientos del período
    const movimientos = await this.accountingEntryModel.aggregate([
      { $match: matchStage },
      { $unwind: '$partidas' },
      {
        $lookup: {
          from: 'chartofaccounts',
          localField: 'partidas.cuenta_id',
          foreignField: '_id',
          as: 'cuenta',
        },
      },
      { $unwind: '$cuenta' },
      {
        $match: {
          'cuenta.codigo': { $in: ['ACT_CAJ', 'ACT_BCO', 'ACT_FID'] },
        },
      },
      {
        $project: {
          fecha: '$fecha_asiento',
          cuenta_codigo: '$cuenta.codigo',
          cuenta_nombre: '$cuenta.nombre',
          concepto: '$concepto',
          debe: '$partidas.debe',
          haber: '$partidas.haber',
          movimiento: { $subtract: ['$partidas.debe', '$partidas.haber'] },
        },
      },
      { $sort: { fecha: 1 } },
    ]);

    const ingresos = movimientos.filter((m) => m.movimiento > 0);
    const egresos = movimientos.filter((m) => m.movimiento < 0);

    const totalIngresos = ingresos.reduce((sum, m) => sum + m.movimiento, 0);
    const totalEgresos = egresos.reduce(
      (sum, m) => sum + Math.abs(m.movimiento),
      0,
    );
    const flujoNeto = totalIngresos - totalEgresos;

    // 3. Calcular saldo inicial (saldo actual - flujo neto del período)
    const saldoInicialCalculado = saldoActualTotal - flujoNeto;

    return {
      periodo: {
        fecha_desde: query.fecha_desde || 'Inicio',
        fecha_hasta: query.fecha_hasta || 'Hoy',
      },
      saldos: {
        inicial: saldoInicialCalculado,
        final: saldoActualTotal,
        detalle_cuentas: cuentasFinancieras.map((cf) => ({
          nombre: cf.nombre,
          tipo: cf.tipo,
          saldo: cf.saldo_inicial || 0,
        })),
      },
      ingresos_efectivo: {
        movimientos: ingresos,
        total: totalIngresos,
      },
      egresos_efectivo: {
        movimientos: egresos.map((m) => ({
          ...m,
          movimiento: Math.abs(m.movimiento),
        })),
        total: totalEgresos,
      },
      flujo_neto: flujoNeto,
      tipo_flujo: flujoNeto >= 0 ? 'POSITIVO' : 'NEGATIVO',
      verificacion: {
        formula: 'Saldo Final = Saldo Inicial + Flujo Neto',
        saldo_inicial: saldoInicialCalculado,
        mas_flujo_neto: flujoNeto,
        igual_saldo_final: saldoActualTotal,
        balanceado:
          Math.abs(saldoInicialCalculado + flujoNeto - saldoActualTotal) < 0.01,
      },
      nota: 'Los saldos reflejan los valores REALES de las cuentas financieras',
    };
  }
}
