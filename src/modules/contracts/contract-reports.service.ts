import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contract } from './entities/contract.entity';
import {
  DashboardSummaryDto,
  UpcomingContractDto,
} from './dto/dashboard-summary.dto';
import { DateTime } from 'luxon';
import { AgenteRoles } from '../agents/constants/agent-roles.enum';

/**
 * Servicio de Reportes para el Dashboard de Contratos
 *
 * Genera métricas consolidadas para visualización operacional y financiera
 * de la cartera de contratos.
 */
@Injectable()
export class ContractReportsService {
  constructor(
    @InjectModel(Contract.name) private readonly contractModel: Model<Contract>,
  ) {}

  /**
   * Genera el resumen completo del dashboard
   *
   * @returns DashboardSummaryDto con todas las métricas consolidadas
   */
  async getDashboardSummary(): Promise<DashboardSummaryDto> {
    const now = DateTime.now();
    const next90Days = now.plus({ days: 90 }).toJSDate();

    // Ejecutar todas las agregaciones en paralelo para optimizar performance
    const [
      statusDistribution,
      dueSoonCount,
      avgMonthlyValue,
      agentRoleCount,
      rescissionData,
      maturityDistribution,
      upcomingContracts,
      totalContracts,
      activeContracts,
    ] = await Promise.all([
      this.getStatusDistribution(),
      this.getDueSoonCount(next90Days),
      this.getAvgMonthlyValue(),
      this.getAgentRoleCount(),
      this.getRescissionData(),
      this.getMaturityDistribution(),
      this.getUpcomingContracts(next90Days),
      this.contractModel.countDocuments(),
      this.contractModel.countDocuments({ status: 'VIGENTE' }),
    ]);

    // Calcular tasa de rescisión
    const rescissionRate = this.calculateRescissionRate(rescissionData);

    // Generar proyección de facturación
    const billingProjection = await this.getBillingProjection();

    return {
      statusDistribution,
      dueSoonCount,
      avgMonthlyValue: Math.round(avgMonthlyValue * 100) / 100,
      agentRoleCount,
      rescissionRate,
      maturityDistribution,
      billingProjection,
      upcomingContracts,
      metadata: {
        generatedAt: now.toJSDate(),
        totalContracts,
        activeContracts,
      },
    };
  }

  /**
   * I. Distribución de Estados
   * Agrupa contratos por estado y cuenta cada categoría
   */
  private async getStatusDistribution(): Promise<{
    VIGENTE: number;
    RESCINDIDO: number;
    FINALIZADO: number;
    PENDIENTE: number;
  }> {
    const result = await this.contractModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Inicializar con valores por defecto
    const distribution = {
      VIGENTE: 0,
      RESCINDIDO: 0,
      FINALIZADO: 0,
      PENDIENTE: 0,
    };

    // Mapear resultados
    result.forEach((item) => {
      if (item._id in distribution) {
        distribution[item._id] = item.count;
      }
    });

    return distribution;
  }

  /**
   * II. Vencimientos y Ajustes Próximos
   * Cuenta contratos vigentes que vencen o requieren ajuste en los próximos 90 días
   */
  private async getDueSoonCount(next90Days: Date): Promise<number> {
    const count = await this.contractModel.countDocuments({
      status: 'VIGENTE',
      $or: [
        { fecha_final: { $lte: next90Days } },
        { ajuste_programado: { $lte: next90Days } },
      ],
    });

    return count;
  }

  /**
   * III. Promedio Financiero
   * Calcula el promedio del monto base vigente de contratos activos
   */
  private async getAvgMonthlyValue(): Promise<number> {
    const result = await this.contractModel.aggregate([
      {
        $match: { status: 'VIGENTE' },
      },
      {
        $group: {
          _id: null,
          avgAmount: { $avg: '$terminos_financieros.monto_base_vigente' },
        },
      },
    ]);

    return result.length > 0 ? result[0].avgAmount : 0;
  }

  /**
   * IV. Distribución de Agentes por Rol
   * Cuenta participaciones de agentes agrupadas por rol
   */
  private async getAgentRoleCount(): Promise<{
    LOCADOR: number;
    LOCATARIO: number;
    GARANTE: number;
    [key: string]: number;
  }> {
    const result = await this.contractModel.aggregate([
      { $match: { status: 'VIGENTE' } },
      { $unwind: '$partes' },
      {
        $group: {
          _id: '$partes.rol',
          count: { $sum: 1 },
        },
      },
    ]);

    const roleCount: {
      LOCADOR: number;
      LOCATARIO: number;
      GARANTE: number;
      [key: string]: number;
    } = {
      LOCADOR: 0,
      LOCATARIO: 0,
      GARANTE: 0,
    };

    result.forEach((item) => {
      roleCount[item._id] = item.count;
    });

    return roleCount;
  }

  /**
   * V. Datos para Cálculo de Tasa de Rescisión
   * Obtiene conteos de contratos rescindidos y finalizados
   */
  private async getRescissionData(): Promise<{
    rescindidos: number;
    finalizados: number;
  }> {
    const [rescindidos, finalizados] = await Promise.all([
      this.contractModel.countDocuments({ status: 'RESCINDIDO' }),
      this.contractModel.countDocuments({ status: 'FINALIZADO' }),
    ]);

    return { rescindidos, finalizados };
  }

  /**
   * Calcula la tasa de rescisión
   * Fórmula: (RESCINDIDO / (RESCINDIDO + FINALIZADO)) * 100
   */
  private calculateRescissionRate(data: {
    rescindidos: number;
    finalizados: number;
  }): number {
    const total = data.rescindidos + data.finalizados;
    if (total === 0) return 0;

    const rate = (data.rescindidos / total) * 100;
    return Math.round(rate * 10) / 10; // Redondear a 1 decimal
  }

  /**
   * VI. Distribución de Madurez (Maturity)
   * Clasifica contratos por duración en meses
   */
  private async getMaturityDistribution(): Promise<{
    '0-12m': number;
    '12-24m': number;
    '24-36m': number;
    '36+m': number;
  }> {
    const result = await this.contractModel.aggregate([
      {
        $match: { status: 'VIGENTE' },
      },
      {
        $addFields: {
          fecha_inicio_date: { $toDate: '$fecha_inicio' },
          fecha_final_date: { $toDate: '$fecha_final' },
        },
      },
      {
        $addFields: {
          duracion_meses: {
            $divide: [
              { $subtract: ['$fecha_final_date', '$fecha_inicio_date'] },
              1000 * 60 * 60 * 24 * 30, // Convertir ms a meses (aproximado)
            ],
          },
        },
      },
      {
        $bucket: {
          groupBy: '$duracion_meses',
          boundaries: [0, 12, 24, 36, 1000], // 0-12, 12-24, 24-36, 36+
          default: '36+m',
          output: {
            count: { $sum: 1 },
          },
        },
      },
    ]);

    const distribution = {
      '0-12m': 0,
      '12-24m': 0,
      '24-36m': 0,
      '36+m': 0,
    };

    const bucketLabels = ['0-12m', '12-24m', '24-36m', '36+m'];
    result.forEach((bucket, index) => {
      distribution[bucketLabels[index]] = bucket.count;
    });

    return distribution;
  }

  /**
   * VII. Proyección de Facturación
   * Genera proyección lineal de los próximos 3 meses basada en histórico de 12 meses
   */
  private async getBillingProjection(): Promise<
    Array<{ month: string; value: number; isProjected: boolean }>
  > {
    const now = DateTime.now();

    // Obtener facturación histórica de los últimos 12 meses
    const historicalData = await this.contractModel.aggregate([
      {
        $match: {
          status: { $in: ['VIGENTE', 'FINALIZADO', 'RESCINDIDO'] },
          fecha_inicio: { $lte: now.toJSDate() },
        },
      },
      {
        $project: {
          monto: '$terminos_financieros.monto_base_vigente',
          fecha_inicio: 1,
          fecha_final: 1,
        },
      },
    ]);

    // Generar serie temporal mensual
    const monthlyRevenue: { month: string; value: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const month = now.minus({ months: i });
      const monthStr = month.toFormat('LLL yyyy');

      // Calcular ingresos del mes sumando contratos activos
      const revenue = historicalData
        .filter((contract) => {
          const start = DateTime.fromJSDate(contract.fecha_inicio);
          const end = DateTime.fromJSDate(contract.fecha_final);
          return start <= month && month <= end;
        })
        .reduce((sum, contract) => sum + contract.monto, 0);

      monthlyRevenue.push({ month: monthStr, value: revenue });
    }

    // Calcular tendencia mediante regresión lineal simple
    const projection = this.calculateLinearRegression(monthlyRevenue);

    // Generar próximos 3 meses proyectados
    for (let i = 1; i <= 3; i++) {
      const futureMonth = now.plus({ months: i });
      const monthStr = futureMonth.toFormat('LLL yyyy');

      // Valor proyectado = última facturación + (tendencia * meses adelante)
      const lastValue = monthlyRevenue[monthlyRevenue.length - 1].value;
      const projectedValue = Math.max(0, lastValue + projection.slope * i);

      monthlyRevenue.push({
        month: monthStr,
        value: Math.round(projectedValue),
      });
    }

    // Marcar los últimos 3 como proyectados
    return monthlyRevenue.map((item, index) => ({
      ...item,
      isProjected: index >= monthlyRevenue.length - 3,
    }));
  }

  /**
   * Calcula regresión lineal simple para proyección
   * Retorna pendiente y ordenada al origen
   */
  private calculateLinearRegression(
    data: Array<{ month: string; value: number }>,
  ): {
    slope: number;
    intercept: number;
  } {
    const n = data.length;
    if (n < 2) return { slope: 0, intercept: 0 };

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    data.forEach((point, index) => {
      const x = index;
      const y = point.value;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  /**
   * VIII. Lista de Contratos con Vencimiento Próximo
   * Retorna detalles de contratos que requieren atención
   */
  private async getUpcomingContracts(
    next90Days: Date,
  ): Promise<UpcomingContractDto[]> {
    const now = DateTime.now();

    const contracts = await this.contractModel
      .find({
        status: 'VIGENTE',
        $or: [
          { fecha_final: { $lte: next90Days } },
          { ajuste_programado: { $lte: next90Days } },
        ],
      })
      .populate('propiedad_id')
      .populate('partes.agente_id')
      .sort({ fecha_final: 1, ajuste_programado: 1 })
      .limit(50); // Limitar a 50 contratos más urgentes

    return contracts.map((contract) => {
      const locatario = contract.partes.find(
        (p) => p.rol === AgenteRoles.LOCATARIO,
      );

      // Determinar cuál fecha es más próxima
      const fechaFinal = DateTime.fromJSDate(contract.fecha_final);
      const ajusteProgramado = contract.ajuste_programado
        ? DateTime.fromJSDate(contract.ajuste_programado)
        : null;

      let dueDate: DateTime;
      let actionType: 'VENCIMIENTO' | 'AJUSTE';

      if (ajusteProgramado && ajusteProgramado < fechaFinal) {
        dueDate = ajusteProgramado;
        actionType = 'AJUSTE';
      } else {
        dueDate = fechaFinal;
        actionType = 'VENCIMIENTO';
      }

      const daysRemaining = Math.ceil(dueDate.diff(now, 'days').days);

      return {
        contractId: contract._id.toString(),
        propertyName: (contract.propiedad_id as any)?.titulo || 'Sin título',
        locatarioName: (locatario?.agente_id as any)?.nombre || 'Sin locatario',
        dueDate: dueDate.toJSDate(),
        daysRemaining,
        actionType,
        currentAmount: contract.terminos_financieros.monto_base_vigente,
      };
    });
  }
}
