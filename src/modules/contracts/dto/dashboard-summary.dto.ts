/**
 * DTO para el Dashboard de Contratos
 *
 * Estructura de datos consolidada que incluye todas las métricas
 * históricas y operacionales del módulo de contratos.
 */

export class DashboardSummaryDto {
  /**
   * I. Distribución de Estados
   * Conteo de contratos agrupados por estado
   */
  statusDistribution: {
    VIGENTE: number;
    RESCINDIDO: number;
    FINALIZADO: number;
    PENDIENTE: number;
  };

  /**
   * II. Vencimientos Próximos
   * Cantidad de contratos que vencen o requieren ajuste en los próximos 90 días
   */
  dueSoonCount: number;

  /**
   * III. Promedio Financiero
   * Promedio del monto base vigente de todos los contratos activos
   */
  avgMonthlyValue: number;

  /**
   * IV. Distribución de Agentes por Rol
   * Conteo de participaciones de agentes agrupadas por rol
   */
  agentRoleCount: {
    LOCADOR: number;
    LOCATARIO: number;
    GARANTE: number;
    [key: string]: number;
  };

  /**
   * V. Tasa de Rescisión
   * Porcentaje de contratos rescindidos sobre el total de contratos cerrados
   * Fórmula: (RESCINDIDO / (RESCINDIDO + FINALIZADO)) * 100
   */
  rescissionRate: number;

  /**
   * VI. Distribución de Madurez (Maturity)
   * Distribución de contratos por rangos de duración en meses
   */
  maturityDistribution: {
    '0-12m': number;
    '12-24m': number;
    '24-36m': number;
    '36+m': number;
  };

  /**
   * VII. Proyección de Facturación
   * Proyección lineal de los próximos 3 meses basada en histórico
   */
  billingProjection: Array<{
    month: string;
    value: number;
    isProjected: boolean;
  }>;

  /**
   * VIII. Lista de Contratos con Vencimiento Próximo
   * Detalles de contratos que requieren atención en los próximos 90 días
   */
  upcomingContracts: Array<{
    contractId: string;
    propertyName: string;
    locatarioName: string;
    dueDate: Date;
    daysRemaining: number;
    actionType: 'VENCIMIENTO' | 'AJUSTE';
    currentAmount: number;
  }>;

  /**
   * Metadatos del reporte
   */
  metadata: {
    generatedAt: Date;
    totalContracts: number;
    activeContracts: number;
  };
}

/**
 * DTO para la respuesta de vencimientos próximos
 */
export class UpcomingContractDto {
  contractId: string;
  propertyName: string;
  locatarioName: string;
  dueDate: Date;
  daysRemaining: number;
  actionType: 'VENCIMIENTO' | 'AJUSTE';
  currentAmount: number;
}
