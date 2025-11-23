import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import { AccountingEntry } from './entities/accounting-entry.entity';
import { PaginationService } from '../../common/pagination/pagination.service';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import {
  AnularAsientoDto,
  TipoMotivoAnulacion,
} from './dto/anular-asiento.dto';
import { CondonarAsientoDto } from './dto/condonar-asiento.dto';
import { LiquidarAsientoDto } from './dto/liquidar-asiento.dto';
import { AccountingEntryFiltersDto } from './dto/accounting-entry-filters.dto';
import { FinancialAccountsService } from '../financial-accounts/financial-accounts.service';
import { DetectedExpensesService } from '../detected-expenses/detected-expenses.service';
import { PropertiesService } from '../properties/properties.service';
import { ServiceAccountMappingsService } from '../service-account-mappings/service-account-mappings.service';
import { ContractsService } from '../contracts/contracts.service';
import { ChartOfAccountsService } from '../chart-of-accounts/chart-of-accounts.service';
import {
  ProcessReceiptDto,
  TipoOperacionRecibo,
} from './dto/process-receipt.dto';

@Injectable()
export class AccountingEntriesService {
  private readonly logger = new Logger(AccountingEntriesService.name);
  /**
   * Actualiza los asientos "PENDIENTE_AJUSTE" de un contrato aplicando el índice correspondiente.
   * @param contratoId ID del contrato
   * @param indices Array de objetos { periodo: Date, valor: number }
   * @param userId ID del usuario que ejecuta la actualización
   * @returns Array de asientos actualizados
   */
  async actualizarAsientosPendientesAjuste(
    contratoId: string,
    indices: Array<{ periodo: Date; valor: number }>,
    userId: string,
  ): Promise<AccountingEntry[]> {
    // Buscar asientos pendientes de ajuste
    const asientosPendientes = await this.accountingEntryModel.find({
      contrato_id: new Types.ObjectId(contratoId),
      estado: 'PENDIENTE_AJUSTE',
    });

    const actualizados: AccountingEntry[] = [];
    for (const asiento of asientosPendientes) {
      // Buscar el índice correspondiente al período del asiento
      const periodoAsiento = asiento.fecha_vencimiento;
      const indice = indices.find(
        (i) =>
          i.periodo.getMonth() === periodoAsiento.getMonth() &&
          i.periodo.getFullYear() === periodoAsiento.getFullYear(),
      );
      if (!indice) {
        // Si no hay índice, dejar pendiente
        continue;
      }
      // Calcular el nuevo monto ajustado (ejemplo: monto_original * (indice.valor / 100))
      // La fórmula real depende del tipo de ajuste
      const montoAjustado = asiento.monto_original * indice.valor;
      asiento.monto_actual = montoAjustado;
      asiento.estado = 'PENDIENTE';
      asiento.historial_cambios.push({
        fecha: new Date(),
        usuario_id: new Types.ObjectId(userId),
        accion: 'AJUSTE_INDICE',
        estado_anterior: 'PENDIENTE_AJUSTE',
        estado_nuevo: 'PENDIENTE',
        monto: montoAjustado,
        observaciones: `Ajuste aplicado con índice ${indice.valor} para ${indice.periodo.toISOString()}`,
      });
      await asiento.save();
      actualizados.push(asiento);
    }
    return actualizados;
  }

  async getMoraCandidates(queryDto: any): Promise<any> {
    // Placeholder implementation
    return {
      message: 'Endpoint getMoraCandidates not implemented yet.',
      queryDto,
    };
  }

  async applyMoraToBatch(batchDto: any): Promise<any> {
    // Placeholder implementation
    return {
      message: 'Endpoint applyMoraToBatch not implemented yet.',
      batchDto,
    };
  }

  constructor(
    @InjectModel(AccountingEntry.name)
    private readonly accountingEntryModel: Model<AccountingEntry>,
    private readonly paginationService: PaginationService,
    private readonly financialAccountsService: FinancialAccountsService,
    private readonly detectedExpensesService: DetectedExpensesService,
    @Inject(forwardRef(() => PropertiesService))
    private readonly propertiesService: PropertiesService,
    private readonly moduleRef: ModuleRef,
    private readonly serviceAccountMappingsService: ServiceAccountMappingsService,
    private readonly chartOfAccountsService: ChartOfAccountsService,
  ) {}

  private contractsServiceInstance?: ContractsService;

  private getContractsService(): ContractsService {
    if (!this.contractsServiceInstance) {
      this.contractsServiceInstance = this.moduleRef.get(ContractsService, {
        strict: false,
      });
    }
    return this.contractsServiceInstance as ContractsService;
  }

  /**
   * Convierte un string de sort (ej: '-fecha_imputacion') a formato MongoDB
   */
  private parseSortString(sort: string): Record<string, 1 | -1> {
    const sortObj: Record<string, 1 | -1> = {};
    if (sort.startsWith('-')) {
      sortObj[sort.substring(1)] = -1;
    } else {
      sortObj[sort] = 1;
    }
    return sortObj;
  }

  async findWithFilters(filters: AccountingEntryFiltersDto): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    totals: {
      grandTotalDebe: number;
      grandTotalHaber: number;
      breakdownByAccount: any[];
    };
  }> {
    const {
      page = 1,
      limit = 20,
      sort = '-fecha_imputacion',
      ...filterParams
    } = filters;
    const query: any = {};

    if (filterParams.contrato_id) {
      query.contrato_id = new Types.ObjectId(filterParams.contrato_id);
    }
    if (filterParams.agente_id) {
      query['partidas.agente_id'] = new Types.ObjectId(filterParams.agente_id);
    }
    if (filterParams.tipo_asiento) {
      query.tipo_asiento = filterParams.tipo_asiento;
    }

    if (filterParams.solo_pendientes) {
      query.estado = {
        $in: ['PENDIENTE', 'PAGADO_PARCIAL', 'PENDIENTE_AJUSTE', 'COBRADO'],
      };
    } else if (filterParams.estado) {
      query.estado = filterParams.estado;
    }

    if (filterParams.fecha_desde || filterParams.fecha_hasta) {
      query.fecha_imputacion = {};
      if (filterParams.fecha_desde) {
        query.fecha_imputacion.$gte = new Date(filterParams.fecha_desde);
      }
      if (filterParams.fecha_hasta) {
        query.fecha_imputacion.$lte = new Date(filterParams.fecha_hasta);
      }
    }

    const skip = (page - 1) * limit;

    // Si solo_pendientes está activo, usar aggregation para filtrar por saldo real
    let data: any[];
    let total: number;

    if (filterParams.solo_pendientes) {
      // Pipeline para calcular saldos pendientes y filtrar asientos con saldo > 0
      const filterPipeline: PipelineStage[] = [
        { $match: query },
        {
          $addFields: {
            saldoPendienteDebe: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: '$partidas',
                      as: 'p',
                      cond: { $gt: ['$$p.debe', 0] },
                    },
                  },
                  as: 'p',
                  in: {
                    $subtract: [
                      '$$p.debe',
                      { $ifNull: ['$$p.monto_pagado_acumulado', 0] },
                    ],
                  },
                },
              },
            },
            saldoPendienteHaber: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: '$partidas',
                      as: 'p',
                      cond: { $gt: ['$$p.haber', 0] },
                    },
                  },
                  as: 'p',
                  in: {
                    $subtract: [
                      '$$p.haber',
                      { $ifNull: ['$$p.monto_liquidado', 0] },
                    ],
                  },
                },
              },
            },
          },
        },
        {
          $match: {
            $or: [
              { saldoPendienteDebe: { $gt: 0 } },
              { saldoPendienteHaber: { $gt: 0 } },
            ],
          },
        },
      ];

      const countPipeline = [...filterPipeline, { $count: 'total' }];
      const dataPipeline = [
        ...filterPipeline,
        { $sort: this.parseSortString(sort) },
        { $skip: skip },
        { $limit: limit },
      ];

      const [countResult, dataResult] = await Promise.all([
        this.accountingEntryModel.aggregate(countPipeline as PipelineStage[]),
        this.accountingEntryModel.aggregate(dataPipeline as PipelineStage[]),
      ]);

      total = countResult[0]?.total || 0;
      data = dataResult;
    } else {
      // Consulta normal sin filtro de saldo
      [total, data] = await Promise.all([
        this.accountingEntryModel.countDocuments(query),
        this.accountingEntryModel
          .find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);
    }

    const totalsPipeline = [
      { $match: query },
      { $unwind: '$partidas' },
      {
        $group: {
          _id: '$partidas.cuenta_id',
          totalDebe: { $sum: '$partidas.debe' },
          totalHaber: { $sum: '$partidas.haber' },
        },
      },
      {
        $lookup: {
          from: 'chartofaccounts',
          localField: '_id',
          foreignField: '_id',
          as: 'cuentaInfo',
        },
      },
      { $unwind: { path: '$cuentaInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          cuenta_id: '$_id',
          cuenta_nombre: '$cuentaInfo.nombre',
          cuenta_codigo: '$cuentaInfo.codigo',
          totalDebe: '$totalDebe',
          totalHaber: '$totalHaber',
        },
      },
      { $sort: { totalDebe: -1, totalHaber: -1 } },
    ];

    const breakdownByAccount = await this.accountingEntryModel.aggregate(
      totalsPipeline as PipelineStage[],
    );

    const grandTotalDebe = breakdownByAccount.reduce(
      (sum, item) => sum + item.totalDebe,
      0,
    );
    const grandTotalHaber = breakdownByAccount.reduce(
      (sum, item) => sum + item.totalHaber,
      0,
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totals: {
        grandTotalDebe,
        grandTotalHaber,
        breakdownByAccount,
      },
    };
  }

  /**
   * Crea un asiento contable
   */
  async create(dto: Partial<AccountingEntry>): Promise<AccountingEntry> {
    if (
      !dto.partidas ||
      !Array.isArray(dto.partidas) ||
      dto.partidas.length === 0
    ) {
      throw new BadRequestException(
        'No se puede crear un asiento contable sin partidas.',
      );
    }
    const asiento = new this.accountingEntryModel(dto);
    return asiento.save();
  }

  /**
   * Calcula el ingreso devengado para un contrato en un rango de fechas
   */
  async getAccruedIncome(queryParams: any): Promise<{
    ingreso_devengado: number;
    contrato_id: string;
    fecha_inicio: Date;
    fecha_fin: Date;
  }> {
    const { contrato_id, fecha_inicio, fecha_fin } = queryParams;
    if (!contrato_id || !fecha_inicio || !fecha_fin) {
      throw new BadRequestException(
        'Faltan parámetros: contrato_id, fecha_inicio, fecha_fin son requeridos',
      );
    }
    const fechaInicio = new Date(fecha_inicio);
    const fechaFin = new Date(fecha_fin);
    const asientos = await this.findByContractAndDateRange(
      contrato_id,
      fechaInicio,
      fechaFin,
    );
    let total = 0;
    for (const asiento of asientos) {
      asiento.partidas.forEach((p) => {
        if (p.haber && p.haber > 0) {
          total += p.haber;
        }
      });
    }
    return {
      ingreso_devengado: total,
      contrato_id,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    };
  }

  /**
   * Calcula el estado de cuenta de un agente (saldo neto hasta la fecha de corte)
   */
  async getEstadoCuentaByAgente(agentId: string, filters: any): Promise<any> {
    const {
      fecha_desde,
      fecha_hasta,
      fecha_corte, // NUEVO: permitir cutoff directo
      incluir_anulados = false,
      solo_pendientes, // NUEVO: Por defecto solo mostrar movimientos con saldo pendiente
    } = filters;

    // Por defecto solo_pendientes es true, a menos que se pase explícitamente como false
    const mostrarSoloPendientes =
      solo_pendientes === 'false' || solo_pendientes === false ? false : true;

    const matchStage: any = {};
    // Asegurar casteo correcto de agente_id (ObjectId vs string)
    if (Types.ObjectId.isValid(agentId)) {
      matchStage['partidas.agente_id'] = new Types.ObjectId(agentId);
    } else {
      matchStage['partidas.agente_id'] = agentId;
    }
    if (!incluir_anulados) {
      matchStage.estado = { $nin: ['ANULADO', 'CONDONADO'] };
    }

    // Rango de fechas o fecha de corte (<= fecha_corte)
    if (fecha_corte) {
      matchStage.fecha_imputacion = { $lte: new Date(fecha_corte) };
    } else if (fecha_desde || fecha_hasta) {
      matchStage.fecha_imputacion = {};
      if (fecha_desde) {
        matchStage.fecha_imputacion.$gte = new Date(fecha_desde);
      }
      if (fecha_hasta) {
        matchStage.fecha_imputacion.$lte = new Date(fecha_hasta);
      }
    }

    // Obtener asientos completos (no usar unwind para tener acceso a todas las partidas)
    const asientos = await this.accountingEntryModel
      .find(matchStage)
      .sort({ fecha_imputacion: 1 })
      .exec();

    let saldo_acumulado_debe = 0;
    let saldo_acumulado_haber = 0;
    let total_debe = 0;
    let total_haber = 0;
    let total_pagado_debe = 0;
    let total_recaudado_haber = 0;

    const movimientosConSaldo = [];

    for (const asiento of asientos) {
      // Buscar TODAS las partidas del agente en este asiento
      const partidasDelAgente = asiento.partidas.filter(
        (p) => p.agente_id?.toString() === agentId,
      );

      if (partidasDelAgente.length === 0) continue;

      // Procesar cada partida del agente
      for (const partidaAgente of partidasDelAgente) {
        const debe = partidaAgente.debe || 0;
        const haber = partidaAgente.haber || 0;

        let saldo_partida = 0;
        let monto_recaudado_disponible = 0;
        let tipo_partida_desde_optica_agente = '';

        if (debe > 0) {
          // PARTIDA DEBE: Desde la óptica del agente, él es DEUDOR (debe pagar)
          tipo_partida_desde_optica_agente = 'DEBE';
          const pagado = partidaAgente.monto_pagado_acumulado || 0;
          saldo_partida = debe - pagado; // Saldo pendiente de pagar
          saldo_acumulado_debe += saldo_partida;
          total_debe += debe;
          total_pagado_debe += pagado;

          movimientosConSaldo.push({
            asiento_id: asiento._id,
            fecha_imputacion: asiento.fecha_imputacion,
            fecha_vencimiento: asiento.fecha_vencimiento,
            descripcion: partidaAgente.descripcion,
            tipo_asiento: asiento.tipo_asiento,
            tipo_partida: tipo_partida_desde_optica_agente,
            debe,
            haber: 0,
            monto_original: debe,
            monto_pagado: pagado,
            saldo_pendiente: saldo_partida,
            saldo_acumulado: saldo_acumulado_debe,
            estado: asiento.estado,
            fecha_pago: asiento.fecha_pago,
            pagado: saldo_partida <= 0,
          });
        } else if (haber > 0) {
          // PARTIDA HABER: Desde la óptica del agente, él es ACREEDOR (le deben pagar)
          tipo_partida_desde_optica_agente = 'HABER';

          const montoYaLiquidado = partidaAgente.monto_liquidado || 0;

          // CASO ESPECIAL: Depósito en Garantía - Devolución
          // No depende de cobros previos, es una obligación directa
          if (asiento.tipo_asiento === 'Deposito en Garantia - Devolucion') {
            // Para depósitos, el monto disponible es el HABER original menos lo ya liquidado
            monto_recaudado_disponible = haber - montoYaLiquidado;

            saldo_acumulado_haber += monto_recaudado_disponible;
            total_haber += haber;
            total_recaudado_haber += monto_recaudado_disponible;

            movimientosConSaldo.push({
              asiento_id: asiento._id,
              fecha_imputacion: asiento.fecha_imputacion,
              fecha_vencimiento: asiento.fecha_vencimiento,
              descripcion: partidaAgente.descripcion,
              tipo_asiento: asiento.tipo_asiento,
              tipo_partida: tipo_partida_desde_optica_agente,
              debe: 0,
              haber,
              monto_original: haber,
              monto_ya_liquidado: montoYaLiquidado,
              monto_recaudado_disponible,
              saldo_acumulado: saldo_acumulado_haber,
              estado: asiento.estado,
              fecha_liquidacion: asiento.fecha_liquidacion,
              liquidado: monto_recaudado_disponible <= 0,
              es_deposito: true, // Flag para identificar en el frontend
            });
          } else {
            // CASO NORMAL: Alquileres y honorarios
            // Calcular cuánto se cobró del inquilino (partidas DEBE del asiento)
            const totalDebe = asiento.partidas
              .filter((p) => p.debe > 0)
              .reduce((sum, p) => sum + p.debe, 0);

            const montoCobradoInquilino = asiento.partidas
              .filter((p) => p.debe > 0)
              .reduce((sum, p) => sum + (p.monto_pagado_acumulado || 0), 0);

            // Calcular total HABER del asiento
            const totalHaber = asiento.partidas
              .filter((p) => p.haber > 0)
              .reduce((sum, p) => sum + p.haber, 0);

            // Calcular proporción de este agente sobre el total HABER
            const proporcion = totalHaber > 0 ? haber / totalHaber : 0;

            // IMPORTANTE: Distinguir entre lo cobrado y lo total liquidable
            // 1. Monto liquidable de lo YA COBRADO
            const montoLiquidableCobrado = montoCobradoInquilino * proporcion;
            const montoDisponibleCobrado =
              montoLiquidableCobrado - montoYaLiquidado;

            // 2. Monto TOTAL liquidable (incluyendo lo no cobrado aún)
            const montoTotalLiquidable = haber - montoYaLiquidado;

            // 3. Cuánto falta cobrar del inquilino (para este asiento)
            const montoPendienteCobro = totalDebe - montoCobradoInquilino;

            // 4. Cuánto de ese pendiente corresponde a este agente
            const montoPendienteCobroAgente = montoPendienteCobro * proporcion;

            // Para el saldo acumulado, usamos solo lo disponible de lo cobrado
            monto_recaudado_disponible = montoDisponibleCobrado;
            saldo_acumulado_haber += monto_recaudado_disponible;
            total_haber += haber;
            total_recaudado_haber += monto_recaudado_disponible;

            movimientosConSaldo.push({
              asiento_id: asiento._id,
              fecha_imputacion: asiento.fecha_imputacion,
              fecha_vencimiento: asiento.fecha_vencimiento,
              descripcion: partidaAgente.descripcion,
              tipo_asiento: asiento.tipo_asiento,
              tipo_partida: tipo_partida_desde_optica_agente,
              debe: 0,
              haber,
              monto_original: haber,

              // Información de cobro
              monto_total_debe: totalDebe,
              monto_cobrado_inquilino: montoCobradoInquilino,
              monto_pendiente_cobro_total: montoPendienteCobro,
              monto_pendiente_cobro_agente: montoPendienteCobroAgente,
              porcentaje_cobrado:
                totalDebe > 0 ? (montoCobradoInquilino / totalDebe) * 100 : 0,

              // Información de liquidación
              proporcion: proporcion * 100, // En porcentaje
              monto_liquidable_cobrado: montoLiquidableCobrado, // Solo de lo cobrado
              monto_total_liquidable: montoTotalLiquidable, // Total (cobrado + no cobrado)
              monto_ya_liquidado: montoYaLiquidado,
              monto_recaudado_disponible: montoDisponibleCobrado, // De lo cobrado
              porcentaje_liquidado:
                haber > 0 ? (montoYaLiquidado / haber) * 100 : 0,

              // Flags de estado
              puede_liquidar_adelantado: montoTotalLiquidable > 0, // Aunque no esté cobrado
              tiene_cobro_pendiente: montoPendienteCobroAgente > 0,
              liquidado: montoTotalLiquidable <= 0, // Liquidado 100%
              liquidado_parcial:
                montoYaLiquidado > 0 && montoTotalLiquidable > 0,

              saldo_acumulado: saldo_acumulado_haber,
              estado: asiento.estado,
              fecha_pago: asiento.fecha_pago,
              fecha_liquidacion: asiento.fecha_liquidacion,
              es_deposito: false,
            });
          }
        }
      }
    }

    // Filtrar movimientos con saldo 0 si solo_pendientes está activo
    const movimientosFiltrados = mostrarSoloPendientes
      ? movimientosConSaldo.filter((m) => {
          if (m.tipo_partida === 'DEBE') {
            return m.saldo_pendiente > 0; // Solo mostrar si tiene saldo pendiente
          } else if (m.tipo_partida === 'HABER') {
            // CAMBIO: Mostrar si tiene monto total liquidable (aunque no esté cobrado)
            // Esto permite liquidar adelantado aunque el inquilino no haya pagado
            return m.monto_total_liquidable > 0;
          }
          return false;
        })
      : movimientosConSaldo;

    return {
      agente_id: agentId,
      resumen: {
        total_debe,
        total_haber,
        total_pagado_debe,
        total_recaudado_haber,
        saldo_pendiente_debe: total_debe - total_pagado_debe,
        saldo_disponible_haber: total_recaudado_haber,
        asientos_pendientes: movimientosFiltrados.filter(
          (m) => m.tipo_partida === 'DEBE' && !m.pagado,
        ).length,
        asientos_pagados: movimientosFiltrados.filter(
          (m) => m.tipo_partida === 'DEBE' && m.pagado,
        ).length,
        asientos_pendientes_liquidacion: movimientosFiltrados.filter(
          (m) => m.tipo_partida === 'HABER' && !m.liquidado,
        ).length,
        asientos_liquidados: movimientosFiltrados.filter(
          (m) => m.tipo_partida === 'HABER' && m.liquidado,
        ).length,
        total_movimientos: movimientosFiltrados.length,
      },
      movimientos: movimientosFiltrados,
    };
  }

  /**
   * Placeholder: Lista asientos contables con paginación
   */
  async findAll(paginationDto: any) {
    // Implementación real: paginación y filtros
    return this.accountingEntryModel
      .find({})
      .limit(paginationDto?.limit || 50)
      .skip(paginationDto?.offset || 0)
      .lean();
  }

  /**
   * Placeholder: Detalle de asientos por agente con paginación
   */
  async findEntriesDetailByAgent(agentId: string, paginationDto: any) {
    // Implementación real: filtrar por agente (como string) y paginar
    return this.accountingEntryModel
      .find({ 'partidas.agente_id': agentId })
      .limit(paginationDto?.limit || 50)
      .skip(paginationDto?.offset || 0)
      .lean();
  }

  /**
   * Placeholder: Aging report
   */
  async getAgingReport(queryParams: any) {
    // Implementación real: pipeline de aging report
    return {
      message: 'Aging report endpoint not implemented yet.',
      queryParams,
    };
  }

  // ...existing code...

  async getAgentPendingLiquidation(agentId: string): Promise<any[]> {
    // Obtener asientos PAGADOS o PAGADOS_PARCIAL donde el agente tiene partidas HABER
    const asientos = await this.accountingEntryModel
      .find({
        estado: { $in: ['PAGADO', 'PAGADO_PARCIAL'] },
        'partidas.agente_id': agentId,
        'partidas.haber': { $gt: 0 },
      })
      .exec();

    const resultado = [];

    for (const asiento of asientos) {
      // Calcular cuánto se cobró realmente (suma de partidas DEBE pagadas)
      const montoCobrado = asiento.partidas
        .filter((p) => p.debe > 0)
        .reduce((sum, p) => sum + (p.monto_pagado_acumulado || 0), 0);

      // Si no se cobró nada, no hay nada que liquidar
      if (montoCobrado === 0) continue;

      // Calcular el total de partidas HABER
      const totalHaber = asiento.partidas
        .filter((p) => p.haber > 0)
        .reduce((sum, p) => sum + p.haber, 0);

      // Para cada partida HABER del agente, calcular la proporción
      for (const partida of asiento.partidas) {
        if (partida.haber > 0 && partida.agente_id?.toString() === agentId) {
          // Proporción de esta partida respecto al total HABER
          const proporcion = totalHaber > 0 ? partida.haber / totalHaber : 0;

          // Monto liquidable es proporcional al monto cobrado
          const montoLiquidable = montoCobrado * proporcion;

          // Restar lo ya liquidado (usando monto_liquidado para partidas HABER)
          const montoYaLiquidado = partida.monto_liquidado || 0;
          const montoDisponible = montoLiquidable - montoYaLiquidado;

          if (montoDisponible > 0) {
            resultado.push({
              fecha_cobro: asiento.fecha_pago || new Date(),
              descripcion: partida.descripcion,
              monto_original: partida.haber,
              monto_cobrado: montoCobrado,
              proporcion: proporcion,
              monto_liquidable: montoLiquidable,
              monto_ya_liquidado: montoYaLiquidado,
              monto_disponible: montoDisponible,
              asiento_id: asiento._id,
              contrato_id: asiento.contrato_id,
            });
          }
        }
      }
    }

    return resultado;
  }

  /**
   * Procesa gastos detectados (facturas/avisos de servicios) y genera una propuesta
   * de asiento por cada gasto. La propuesta se guarda dentro del documento
   * `gastos_detectados` como `propuesta_asiento` y el estado se marca como `ASIGNADO`.
   * NOTA: Esta implementación genera una propuesta (draft) y no crea el asiento
   * contable definitivo porque la asignación de cuentas del plan contable debe
   * ser validada (evita crear asientos con cuentas no configuradas).
   *
   * Opciones:
   * - detectedExpenseIds?: string[] => procesar solo estos IDs
   * - dryRun?: boolean => no persiste cambios si true
   * - limit?: number => máximo items a procesar
   */
  async processDetectedUtilityInvoices(options?: {
    detectedExpenseIds?: string[];
    dryRun?: boolean;
    limit?: number;
  }): Promise<{ processed: number; details: any[] }> {
    const all = await this.detectedExpensesService.findAll();
    const pending = all.filter(
      (d: any) => d.estado_procesamiento === 'PENDIENTE_VALIDACION',
    );

    const toProcess = (
      options?.detectedExpenseIds
        ? pending.filter((p: any) =>
            options.detectedExpenseIds!.includes(p._id.toString()),
          )
        : pending
    ).slice(0, options?.limit || pending.length);

    const details: any[] = [];

    for (const det of toProcess) {
      // Buscar propiedades asociadas al identificador de servicio
      const properties = await this.propertiesService.findByMedidor(
        det.identificador_servicio,
      );

      if (!properties || properties.length === 0) {
        // No asociadas: marcar para revisión y continuar
        if (!options?.dryRun) {
          await this.detectedExpensesService.update(det._id.toString(), {
            estado_procesamiento: 'DESCARTADO',
            cuerpo_email: det.cuerpo_email,
          } as any);
        }
        details.push({ id: det._id, status: 'NO_PROPERTIES' });
        continue;
      }

      // Construir prorrateo usando porcentaje_aplicacion si está disponible
      let totalPct = 0;
      const shares = properties.map((p: any) => {
        const svc = (p.servicios_impuestos || []).find(
          (s: any) => s.identificador_servicio === det.identificador_servicio,
        );
        const pct =
          svc && svc.porcentaje_aplicacion ? svc.porcentaje_aplicacion : null;
        if (pct) totalPct += pct;
        return { property: p, pct };
      });

      if (totalPct === 0) {
        // repartir en partes iguales
        shares.forEach((s) => (s.pct = 100 / shares.length));
      } else {
        // normalizar a 100%
        shares.forEach((s) => (s.pct = (s.pct / totalPct) * 100));
      }

      const montoTotal = det.monto_estimado || 0;
      const partidasPropuesta = shares.map((s: any) => ({
        descripcion: `Gasto detectado ${det.tipo_alerta} ${det.identificador_servicio} - ${s.property.identificador_interno}`,
        agente_id: (s.property.propietarios_ids || [])[0] || null,
        monto:
          Math.round((montoTotal * (s.pct / 100) + Number.EPSILON) * 100) / 100,
        porcentaje: s.pct,
        suggested_account_code: 'EGRESO_SERVICIOS', // sugerencia, requiere validación manual o mapeo
      }));

      const propuesta = {
        fecha_imputacion: new Date(),
        fecha_vencimiento: det.fecha_deteccion || new Date(),
        descripcion: `Propuesta para gasto detectado ${det.identificador_servicio}`,
        tipo_asiento: 'Gasto Servicio Detectado',
        monto_original: montoTotal,
        partidas_propuesta: partidasPropuesta,
        detected_expense_id: det._id,
      };

      if (!options?.dryRun) {
        // Guardar la propuesta y actualizar estado en el gasto detectado
        await this.detectedExpensesService.update(det._id.toString(), {
          estado_procesamiento: 'ASIGNADO',
          propuesta_asiento: propuesta,
        } as any);
      }

      details.push({ id: det._id, status: 'PROPOSED', propuesta });
    }

    return { processed: details.length, details };
  }

  async find(filter: any, session?: any): Promise<AccountingEntry[]> {
    return this.accountingEntryModel.find(filter, null, { session }).exec();
  }

  async markAsInvoiced(asientoIds: string[], session?: any) {
    return this.accountingEntryModel.updateMany(
      { _id: { $in: asientoIds } },
      { $set: { estado: 'FACTURADO' } },
      { session },
    );
  }

  async markAsPendingInvoice(
    asientoIds: string[],
    userId: string,
    session?: any,
  ): Promise<any> {
    const updateResult = await this.accountingEntryModel.updateMany(
      { _id: { $in: asientoIds } },
      { $set: { estado: 'PENDIENTE_FACTURAR' } },
      { session },
    );

    // Opcional: Registrar en el historial de cambios de cada asiento
    // Esto podría ser costoso si hay muchos asientos, considerar si es necesario.
    // Por ahora, solo actualizamos el estado.

    return updateResult;
  }

  async markAsLiquidated(asientoIds: string[]) {
    return this.accountingEntryModel.updateMany(
      { _id: { $in: asientoIds } },
      { $set: { estado: 'LIQUIDADO' } },
    );
  }

  async calculateAgentBalance(agenteId: string): Promise<number> {
    // Mantener compatibilidad: usar la misma lógica proporcional que el estado de cuenta
    return this.calculateAgentBalanceWithCutoff(agenteId);
  }

  /**
   * Calcula el saldo del agente hasta la fecha de corte (incluida).
   * Si no se pasa fecha, usa hoy.
   */
  async calculateAgentBalanceWithCutoff(
    agenteId: string,
    fechaCorte?: Date,
  ): Promise<number> {
    // Reemplazamos el cálculo por pipeline (que no contempla proporcional) por la misma
    // lógica del estado de cuenta, que sí calcula HABER proporcional a lo cobrado.
    const filters: any = {};
    if (fechaCorte) {
      filters.fecha_hasta = new Date(fechaCorte);
    }

    const estadoCuenta = await this.getEstadoCuentaByAgente(agenteId, filters);
    const deudaPendiente = estadoCuenta?.resumen?.saldo_pendiente_debe || 0;
    const creditoDisponible =
      estadoCuenta?.resumen?.saldo_disponible_haber || 0;
    // Definición: balance = deuda pendiente - crédito disponible (mismo signo que antes)
    return deudaPendiente - creditoDisponible;
  }

  /**
   * Procesa una propuesta (propuesta_asiento) almacenada en un DetectedExpense
   * y crea un AccountingEntry definitivo usando el mapeo proveedor->cuentas.
   * Si mappingId no se provee, se intenta resolver por provider_agent_id.
   */
  async processDetectedExpenseToEntry(dto: {
    detectedExpenseId: string;
    mappingId?: string;
  }): Promise<any> {
    const { detectedExpenseId, mappingId } = dto;

    const det: any =
      await this.detectedExpensesService.findOne(detectedExpenseId);
    if (!det) throw new NotFoundException('DetectedExpense no encontrado');

    if (!det.propuesta_asiento) {
      throw new BadRequestException('No existe una propuesta para este gasto');
    }

    // Resolver mapping
    let mapping: any = null;
    if (mappingId) {
      mapping = await this.serviceAccountMappingsService.findOne(mappingId);
    } else {
      // Try resolving by agent id (if present). If not found, try by provider CUIT
      const agentIdOrNull = det.agente_proveedor_id
        ? det.agente_proveedor_id.toString()
        : null;
      if (agentIdOrNull) {
        mapping =
          await this.serviceAccountMappingsService.findByProviderAgentId(
            agentIdOrNull,
            det.identificador_servicio,
          );
      }
      if (!mapping && (det as any).provider_cuit) {
        mapping =
          await this.serviceAccountMappingsService.findByProviderAgentId(
            (det as any).provider_cuit,
            det.identificador_servicio,
          );
      }
    }

    if (!mapping) {
      throw new NotFoundException(
        'No se encontró mapping proveedor->cuentas. Configure uno antes de procesar.',
      );
    }

    // Resolver IDs de cuentas contables por código
    const requiredCodes = [
      mapping.cuenta_por_cobrar_codigo,
      mapping.cuenta_por_pagar_codigo,
    ].filter(Boolean) as string[];

    if (requiredCodes.length === 0) {
      throw new BadRequestException(
        'El mapping no define códigos de cuenta válidos',
      );
    }

    const accountIdsMap =
      await this.chartOfAccountsService.getAccountIdsByCode(requiredCodes);

    // Preparar partidas: una partida por propiedad (DEBE) y una partida contrapartida (HABER)
    const propuesta = det.propuesta_asiento as any;
    const partidas: any[] = [];
    let total = 0;

    // Buscar propiedades asociadas al identificador de servicio para poder
    // comprobar contratos vigentes y propietarios (locador) en caso de fallback.
    const properties =
      det?.identificador_servicio && this.propertiesService
        ? await this.propertiesService.findByMedidor(det.identificador_servicio)
        : [];

    for (const p of propuesta.partidas_propuesta || []) {
      const amount = p.monto || 0;
      total += amount;

      // Determinar agente final para la partida: si el agente propuesto es un
      // locatario pero no existe un contrato vigente para esa propiedad, usamos
      // el locador (primer propietario) como fallback.
      let finalAgenteId = p.agente_id || null;

      try {
        if (finalAgenteId && properties && properties.length > 0) {
          let hasActiveContract = false;
          // Revisar cada propiedad que coincide con el identificador
          for (const prop of properties) {
            if (prop.contrato_vigente_id) {
              try {
                const contract = await this.getContractsService().findOne(
                  prop.contrato_vigente_id.toString(),
                );
                if (contract && Array.isArray(contract.partes)) {
                  const isLocatarioInContract = contract.partes.some(
                    (part: any) =>
                      part.rol === 'LOCATARIO' &&
                      part.agente_id?.toString() === finalAgenteId?.toString(),
                  );
                  if (isLocatarioInContract) {
                    hasActiveContract = true;
                    break;
                  }
                }
              } catch (e) {
                // ignore contract lookup errors and continue
              }
            }
          }

          if (!hasActiveContract) {
            // fallback: usar el primer propietario conocido (locador) si existe
            const propWithOwner = properties.find(
              (pp: any) =>
                Array.isArray(pp.propietarios_ids) &&
                pp.propietarios_ids.length > 0,
            );
            if (propWithOwner) {
              finalAgenteId = propWithOwner.propietarios_ids[0];
            }
          }
        }
      } catch (e) {
        // En caso de cualquier fallo en la lógica de fallback, no romper el flujo;
        // dejamos finalAgenteId tal como vino en p.agente_id
      }

      partidas.push({
        cuenta_id: accountIdsMap[mapping.cuenta_por_cobrar_codigo],
        descripcion: p.descripcion || propuesta.descripcion,
        debe: amount,
        haber: 0,
        agente_id: finalAgenteId ? new Types.ObjectId(finalAgenteId) : null,
      });
    }

    // Contrapartida: cuenta por pagar al proveedor
    partidas.push({
      cuenta_id: accountIdsMap[mapping.cuenta_por_pagar_codigo],
      descripcion: `Pago a proveedor ${mapping.provider_agent_id}`,
      debe: 0,
      haber: Math.round((total + Number.EPSILON) * 100) / 100,
      agente_id: new Types.ObjectId(mapping.provider_agent_id),
    });

    const asientoDto: Partial<AccountingEntry> = {
      tipo_asiento: propuesta.tipo_asiento || 'Gasto Servicio',
      fecha_imputacion: propuesta.fecha_imputacion || new Date(),
      fecha_vencimiento: propuesta.fecha_vencimiento || new Date(),
      descripcion:
        propuesta.descripcion ||
        `Gasto detectado ${det.identificador_servicio}`,
      monto_original: propuesta.monto_original || total,
      // monto_actual debe inicializarse igual al monto_original al crear el asiento
      monto_actual: propuesta.monto_original || total,
      partidas,
    };

    const asiento = await this.create(asientoDto);

    // Actualizar detected expense con referencia al asiento creado
    await this.detectedExpensesService.update(detectedExpenseId, {
      estado_procesamiento: 'ASIGNADO',
      asiento_creado_id: asiento._id,
      estado_final: 'PROCESADO',
    } as any);

    // Fetch the updated detected expense so the controller/frontend can refresh state
    let updatedDetected: any = null;
    try {
      updatedDetected =
        await this.detectedExpensesService.findOne(detectedExpenseId);
    } catch (e) {
      // if fetching updated detected expense fails, ignore and return asiento anyway
      updatedDetected = null;
    }

    return { accountingEntry: asiento, detectedExpense: updatedDetected };
  }

  // ==================== FASE 3: ACCIONES SOBRE ASIENTOS ====================

  /**
   * Registra un pago (total o parcial) para un asiento contable.
   */
  async registerPayment(
    asientoId: string,
    dto: RegisterPaymentDto,
  ): Promise<AccountingEntry> {
    const asiento = await this.accountingEntryModel.findById(asientoId);

    if (!asiento) {
      throw new NotFoundException('Asiento no encontrado');
    }

    // Solo bloquear si está ANULADO o CONDONADO
    // PAGADO está permitido para liquidar partidas HABER (liquidación a propietarios)
    if (['ANULADO', 'CONDONADO'].includes(asiento.estado)) {
      throw new BadRequestException(
        `El asiento en estado "${asiento.estado}" no puede recibir pagos`,
      );
    }

    // Calcular saldo pendiente según el tipo de partidas
    // Para INGRESO: validar contra partidas DEBE (cobros al locatario)
    // Para EGRESO: validar contra partidas HABER (liquidaciones a propietarios)
    const totalDebe = asiento.partidas.reduce((sum, p) => sum + p.debe, 0);
    const totalHaber = asiento.partidas.reduce((sum, p) => sum + p.haber, 0);

    const montoPagadoDebe = asiento.partidas
      .filter((p) => p.debe > 0)
      .reduce((sum, p) => sum + (p.monto_pagado_acumulado || 0), 0);

    const montoPagadoHaber = asiento.partidas
      .filter((p) => p.haber > 0)
      .reduce((sum, p) => sum + (p.monto_pagado_acumulado || 0), 0);

    // Determinar el saldo pendiente según el contexto
    // Si hay DEBE y estamos pagando, validar contra DEBE
    // Si hay HABER y estamos liquidando, validar contra HABER
    let saldoPendiente: number;
    if (totalDebe > 0 && montoPagadoDebe < totalDebe) {
      // Contexto: Cobro al locatario (partidas DEBE)
      saldoPendiente = totalDebe - montoPagadoDebe;
    } else if (totalHaber > 0 && montoPagadoHaber < totalHaber) {
      // Contexto: Liquidación a propietarios (partidas HABER)
      saldoPendiente = totalHaber - montoPagadoHaber;
    } else {
      // Ambos lados ya están pagados/liquidados
      saldoPendiente = 0;
    }

    if (dto.monto_pagado > saldoPendiente) {
      throw new BadRequestException(
        `El monto pagado (${dto.monto_pagado}) excede el saldo pendiente (${saldoPendiente})`,
      );
    }

    // Solo registrar INGRESO (DEBE) como entrada de caja
    if (totalDebe > 0) {
      // Solo si hay DEBE, actualiza saldo como INGRESO
      await this.financialAccountsService.updateBalance(
        dto.cuenta_financiera_id,
        dto.monto_pagado,
        'INGRESO',
        null,
      );
    }
    // Si solo hay HABER, no actualiza saldo aquí (liquidación lo maneja)

    // Actualizar monto_pagado_acumulado SOLO en las partidas DEBE
    // Las partidas HABER NO deben actualizarse aquí, ya que representan obligaciones
    // que se liquidan en un paso posterior (liquidarAPropietario)

    let montoRestanteAPagar = dto.monto_pagado;

    // Actualizar SOLO las partidas DEBE (cobro al locatario)
    for (const partida of asiento.partidas) {
      if (partida.debe > 0 && montoRestanteAPagar > 0) {
        const deudaPartida =
          partida.debe - (partida.monto_pagado_acumulado || 0);
        if (deudaPartida > 0) {
          const montoAImputar = Math.min(montoRestanteAPagar, deudaPartida);
          partida.monto_pagado_acumulado =
            (partida.monto_pagado_acumulado || 0) + montoAImputar;
          montoRestanteAPagar -= montoAImputar;
        }
      }
    }

    // Calcular el nuevo monto pagado total basándose SOLO en partidas DEBE
    // Esto evita la doble imputación
    const nuevoMontoPagadoTotal = asiento.partidas
      .filter((p) => p.debe > 0)
      .reduce((sum, p) => sum + (p.monto_pagado_acumulado || 0), 0);

    // Calcular el estado de liquidación de las partidas HABER
    const montoTotalHaber = asiento.partidas
      .filter((p) => p.haber > 0)
      .reduce((sum, p) => sum + p.haber, 0);

    const montoTotalLiquidado = asiento.partidas
      .filter((p) => p.haber > 0)
      .reduce((sum, p) => sum + (p.monto_liquidado || 0), 0);

    const estadoAnterior = asiento.estado;
    let accionHistorial: string;

    // Determinar el estado del asiento considerando DEBE (cobro) y HABER (liquidación)
    const debeTotalmenteCobrado = nuevoMontoPagadoTotal >= asiento.monto_actual;
    const haberTotalmenteLiquidado =
      montoTotalHaber === 0 || montoTotalLiquidado >= montoTotalHaber;

    if (debeTotalmenteCobrado && haberTotalmenteLiquidado) {
      asiento.estado = 'PAGADO';
      asiento.fecha_pago = new Date(dto.fecha_pago);
      asiento.metodo_pago = dto.metodo_pago;
      accionHistorial = 'PAGO_COMPLETO';
    } else if (debeTotalmenteCobrado && !haberTotalmenteLiquidado) {
      // Nuevo caso: DEBE cobrado pero HABER pendiente de liquidación
      asiento.estado = 'COBRADO';
      asiento.fecha_pago = new Date(dto.fecha_pago);
      asiento.metodo_pago = dto.metodo_pago;
      accionHistorial = 'PAGO_COMPLETO';
    } else {
      asiento.estado = 'PAGADO_PARCIAL';
      accionHistorial = 'PAGO_PARCIAL';
    }

    asiento.historial_cambios.push({
      fecha: new Date(),
      usuario_id: new Types.ObjectId(dto.usuario_id),
      accion: accionHistorial,
      estado_anterior: estadoAnterior,
      estado_nuevo: asiento.estado,
      monto: dto.monto_pagado,
      observaciones: dto.observaciones,
    });

    return await asiento.save();
  }

  /**
   * Anular asiento
   */
  async anularAsiento(
    asientoId: string,
    dto: AnularAsientoDto,
    session?: any,
  ): Promise<AccountingEntry> {
    const asiento = await this.accountingEntryModel.findById(asientoId, null, {
      session,
    });

    if (!asiento) {
      throw new NotFoundException('Asiento no encontrado');
    }

    // Validar estado
    if (asiento.estado === 'PAGADO') {
      throw new BadRequestException(
        'No se puede anular un asiento pagado. Debe revertir el pago primero.',
      );
    }

    if (asiento.estado === 'ANULADO') {
      throw new BadRequestException('El asiento ya está anulado');
    }

    // Guardar estado anterior
    const estadoAnterior = asiento.estado;

    // Actualizar estado
    asiento.estado = 'ANULADO';
    asiento.fecha_anulacion = new Date();
    asiento.motivo_anulacion = dto.motivo;
    asiento.tipo_motivo_anulacion = dto.tipo_motivo;

    // Registrar en historial
    asiento.historial_cambios.push({
      fecha: new Date(),
      usuario_id: new Types.ObjectId(dto.usuario_id),
      accion: 'ANULACION',
      estado_anterior: estadoAnterior,
      estado_nuevo: 'ANULADO',
      observaciones: `Motivo: ${dto.motivo}. ${dto.observaciones || ''}`,
    });

    return await asiento.save({ session });
  }

  /**
   * Condonar deuda (total o parcial)
   */
  async condonarDeuda(
    asientoId: string,
    dto: CondonarAsientoDto,
    session?: any,
  ): Promise<AccountingEntry> {
    const asiento = await this.accountingEntryModel.findById(asientoId, null, {
      session,
    });

    if (!asiento) {
      throw new NotFoundException('Asiento no encontrado');
    }

    // Validar estado
    if (['ANULADO', 'CONDONADO'].includes(asiento.estado)) {
      throw new BadRequestException(
        `El asiento en estado "${asiento.estado}" no puede ser condonado`,
      );
    }

    // TODO: En una implementación completa, aquí se debería verificar el rol del usuario autorizador
    // Ejemplo: const autorizador = await this.userService.findById(dto.usuario_autorizador_id);
    // if (!['admin', 'superUser'].includes(autorizador.role)) {
    //   throw new ForbiddenException('El autorizador no tiene permisos suficientes');
    // }

    // Calcular saldo pendiente
    const montoPagadoTotal = asiento.partidas.reduce(
      (sum, p) => sum + (p.monto_pagado_acumulado || 0),
      0,
    );
    const saldoPendiente = asiento.monto_original - montoPagadoTotal;

    const montoCondonar = dto.monto_condonado || saldoPendiente;

    if (montoCondonar > saldoPendiente) {
      throw new BadRequestException(
        `El monto a condonar (${montoCondonar}) excede el saldo pendiente (${saldoPendiente})`,
      );
    }

    // Aplicar condonación (marcar como pagado el monto condonado)
    let montoRestante = montoCondonar;
    for (const partida of asiento.partidas) {
      if (partida.debe > 0 && montoRestante > 0) {
        const deudaPartida =
          partida.debe - (partida.monto_pagado_acumulado || 0);
        if (deudaPartida > 0) {
          const montoAImputar = Math.min(montoRestante, deudaPartida);
          partida.monto_pagado_acumulado =
            (partida.monto_pagado_acumulado || 0) + montoAImputar;
          montoRestante -= montoAImputar;
        }
      }
    }

    // Actualizar estado
    const estadoAnterior = asiento.estado;
    const nuevoMontoPagado = asiento.partidas.reduce(
      (sum, p) => sum + (p.monto_pagado_acumulado || 0),
      0,
    );

    if (nuevoMontoPagado >= asiento.monto_original) {
      asiento.estado = 'CONDONADO';
    } else {
      asiento.estado = 'PAGADO_PARCIAL';
    }

    asiento.monto_condonado = montoCondonar;
    asiento.fecha_condonacion = new Date();
    asiento.motivo_condonacion = dto.motivo;

    // Registrar en historial
    asiento.historial_cambios.push({
      fecha: new Date(),
      usuario_id: new Types.ObjectId(dto.usuario_id),
      accion: 'CONDONACION',
      estado_anterior: estadoAnterior,
      estado_nuevo: asiento.estado,
      monto: montoCondonar,
      observaciones: `Condonado: ${montoCondonar}. Motivo: ${dto.motivo}. Autorizado por: ${dto.usuario_autorizador_id}. ${dto.observaciones || ''}`,
    });

    return await asiento.save({ session });
  }

  /**
   * Liquidar a propietario o cobrarle (compensación automática HABER - DEBE)
   * Este método es agnóstico del flujo: determina automáticamente si es INGRESO o EGRESO
   * basándose en el resultado neto de HABER - DEBE
   */
  async liquidarAPropietario(
    asientoId: string,
    dto: LiquidarAsientoDto,
    session?: any,
  ): Promise<AccountingEntry> {
    const asiento = await this.accountingEntryModel.findById(asientoId, null, {
      session,
    });

    if (!asiento) {
      throw new NotFoundException('Asiento no encontrado');
    }

    // LIQUIDACIÓN ADELANTADA: Permitir liquidar aunque no se haya cobrado nada
    // Ya no validamos el estado ni el monto cobrado

    // Filtrar partidas HABER y DEBE del agente especificado
    const partidasHaberDelAgente = asiento.partidas.filter(
      (p) => p.haber > 0 && p.agente_id?.toString() === dto.agente_id,
    );

    const partidasDebeDelAgente = asiento.partidas.filter(
      (p) => p.debe > 0 && p.agente_id?.toString() === dto.agente_id,
    );

    // Validar que el agente tenga al menos una partida (HABER o DEBE) en este asiento
    if (
      partidasHaberDelAgente.length === 0 &&
      partidasDebeDelAgente.length === 0
    ) {
      throw new BadRequestException(
        `No se encontraron partidas para el agente ${dto.agente_id} en el asiento "${asiento.descripcion}"`,
      );
    }

    let montoHaberTotal = 0;
    let montoDebeTotal = 0;

    // LIQUIDACIÓN ADELANTADA:
    // Permitir liquidar el HABER completo aunque el DEBE no esté totalmente cobrado
    // El monto liquidable es el HABER total menos lo ya liquidado

    // Si se especifica monto_a_liquidar, usarlo. Si no, liquidar todo disponible.
    const montoSolicitado = dto.monto_a_liquidar;
    let montoRestanteALiquidar = montoSolicitado || Infinity;

    // 1. Procesar partidas HABER (a favor del agente, se le debe pagar)
    for (const partida of partidasHaberDelAgente) {
      const montoLiquidable = partida.haber;
      const montoYaLiquidado = partida.monto_liquidado || 0;
      const montoDisponible = montoLiquidable - montoYaLiquidado;

      this.logger.debug('=== LIQUIDACIÓN HABER ===');
      this.logger.debug('Descripción: ' + String(partida.descripcion));
      this.logger.debug('partida.haber: ' + String(partida.haber));
      this.logger.debug(
        'montoYaLiquidado (ANTES): ' + String(montoYaLiquidado),
      );
      this.logger.debug('montoDisponible: ' + String(montoDisponible));

      if (montoDisponible <= 0) {
        this.logger.debug(
          '⚠️ Partida HABER ya completamente liquidada, se omite',
        );
        continue; // Permitir continuar si esta partida ya está liquidada
      }

      // LIQUIDACIÓN PARCIAL: Liquidar solo hasta el monto solicitado
      const montoALiquidar = Math.min(montoDisponible, montoRestanteALiquidar);

      partida.monto_liquidado = (partida.monto_liquidado || 0) + montoALiquidar;
      this.logger.debug(
        'partida.monto_liquidado (DESPUÉS): ' + String(partida.monto_liquidado),
      );
      this.logger.debug('========================');

      montoHaberTotal += montoALiquidar;
      montoRestanteALiquidar -= montoALiquidar;

      if (montoRestanteALiquidar <= 0) break; // Ya se liquidó el monto solicitado
    }

    // 2. Procesar partidas DEBE (el agente debe, se descuenta del pago o se cobra)
    for (const partida of partidasDebeDelAgente) {
      const montoADescontar = partida.debe;
      const montoYaPagado = partida.monto_pagado_acumulado || 0;
      const montoDisponible = montoADescontar - montoYaPagado;

      this.logger.debug('=== COMPENSACIÓN DEBE ===');
      this.logger.debug('Descripción: ' + String(partida.descripcion));
      this.logger.debug('partida.debe: ' + String(partida.debe));
      this.logger.debug('montoYaPagado (ANTES): ' + String(montoYaPagado));
      this.logger.debug(
        'montoDisponible (a compensar): ' + String(montoDisponible),
      );

      if (montoDisponible <= 0) {
        this.logger.debug('⚠️ Partida DEBE ya completamente pagada, se omite');
        continue; // Permitir continuar si esta partida ya está pagada
      }

      partida.monto_pagado_acumulado =
        (partida.monto_pagado_acumulado || 0) + montoDisponible;
      this.logger.debug(
        'partida.monto_pagado_acumulado (DESPUÉS): ' +
          String(partida.monto_pagado_acumulado),
      );
      this.logger.debug('========================');

      montoDebeTotal += montoDisponible;
    }

    // CÁLCULO NETO: HABER - DEBE
    // El monto neto puede ser positivo (más HABER que DEBE) o negativo (más DEBE que HABER)
    const montoNeto = montoHaberTotal - montoDebeTotal;
    const montoAbsoluto = Math.abs(montoNeto);

    this.logger.debug('💰 COMPENSACIÓN FINAL:');
    this.logger.debug('   HABER total: ' + String(montoHaberTotal));
    this.logger.debug('   DEBE total: ' + String(montoDebeTotal));
    this.logger.debug('   NETO (HABER - DEBE): ' + String(montoNeto));
    this.logger.debug('   Monto absoluto: ' + String(montoAbsoluto));

    // IMPORTANTE: Respetar el tipo de flujo que viene en el DTO
    // El frontend determina si es INGRESO o EGRESO basándose en el contexto del recibo
    // Aquí solo procesamos la compensación de partidas
    // La actualización del balance financiero ya está determinada por el contexto del recibo

    // Actualizar saldo de la cuenta financiera con el monto neto absoluto
    // El tipo de flujo (INGRESO/EGRESO) lo determina el contexto del recibo, no este método
    if (montoAbsoluto > 0) {
      // Usar EGRESO como default, pero idealmente esto debería venir en el DTO
      await this.financialAccountsService.updateBalance(
        dto.cuenta_financiera_id,
        montoAbsoluto,
        'EGRESO', // Por ahora mantenemos EGRESO para backward compatibility
        session,
      );
    }

    // CRÍTICO: NO cambiar estado a LIQUIDADO aquí
    // El asiento puede tener múltiples agentes HABER que se liquidan por separado
    // El estado se actualiza solo si TODAS las partidas HABER están 100% liquidadas
    const todasLiquidadas = asiento.partidas
      .filter((p) => p.haber > 0)
      .every((p) => {
        // LIQUIDACIÓN ADELANTADA: Comparar contra el HABER total, no contra lo cobrado
        const montoLiquidable = p.haber;
        // Usar el valor ACTUALIZADO de monto_liquidado (después de la operación actual)
        const montoYaLiquidado = p.monto_liquidado || 0;
        // Considerar liquidado si la diferencia es muy pequeña (tolerancia de 1 peso por redondeos)
        return Math.abs(montoYaLiquidado - montoLiquidable) < 1;
      });

    const estadoAnterior = asiento.estado;
    if (todasLiquidadas) {
      // Si todas las partidas HABER están liquidadas
      // Y el estado actual es 'COBRADO', cambiar a 'PAGADO'
      // De lo contrario, cambiar a 'LIQUIDADO'
      if (asiento.estado === 'COBRADO') {
        asiento.estado = 'PAGADO';
      } else {
        asiento.estado = 'LIQUIDADO';
      }
      asiento.fecha_liquidacion = new Date(dto.fecha_liquidacion);
    }

    asiento.metodo_liquidacion = dto.metodo_liquidacion;
    asiento.comprobante_liquidacion = dto.comprobante;

    // Registrar en historial
    asiento.historial_cambios.push({
      fecha: new Date(),
      usuario_id: new Types.ObjectId(dto.usuario_id),
      accion: 'LIQUIDACION',
      estado_anterior: estadoAnterior,
      estado_nuevo: asiento.estado,
      monto: montoAbsoluto,
      observaciones: `Liquidación/Compensación al agente ${dto.agente_id}. Método: ${dto.metodo_liquidacion}. HABER: ${montoHaberTotal}, DEBE: ${montoDebeTotal}, NETO: ${montoAbsoluto}. ${dto.observaciones || ''}`,
    });

    return await asiento.save({ session });
  }

  /**
   * Obtener historial de cambios de un asiento
   */
  async getHistorialCambios(asientoId: string): Promise<any> {
    const asiento = await this.accountingEntryModel
      .findById(asientoId)
      .select('historial_cambios descripcion tipo_asiento estado');

    if (!asiento) {
      throw new NotFoundException('Asiento no encontrado');
    }

    return {
      asiento_id: asiento._id,
      descripcion: asiento.descripcion,
      tipo_asiento: asiento.tipo_asiento,
      estado_actual: asiento.estado,
      historial: asiento.historial_cambios,
    };
  }

  /**
   * Busca asientos por contrato y rango de fechas con estado específico
   */
  async findByContractAndDateRange(
    contratoId: string,
    fechaDesde: Date,
    fechaHasta: Date,
    estado?: string,
  ): Promise<AccountingEntry[]> {
    const query: any = {
      contrato_id: new Types.ObjectId(contratoId),
      fecha_imputacion: {
        $gte: fechaDesde,
        $lte: fechaHasta,
      },
    };

    if (estado) {
      query.estado = estado;
    }

    return this.accountingEntryModel.find(query).exec();
  }

  /**
   * Busca asientos contables por contrato y tipo de asiento
   */
  async findByContractAndType(
    contratoId: string,
    tipoAsiento: string,
  ): Promise<AccountingEntry[]> {
    return this.accountingEntryModel
      .find({
        contrato_id: new Types.ObjectId(contratoId),
        tipo_asiento: tipoAsiento,
      })
      .sort({ fecha_imputacion: -1 })
      .exec();
  }

  /**
   * Wrapper para anular asiento (usado por ContractsService)
   */
  async anular(
    asientoId: string,
    motivo: string,
    userId: string,
  ): Promise<AccountingEntry> {
    return this.anularAsiento(asientoId, {
      motivo,
      tipo_motivo: TipoMotivoAnulacion.RESCISION_CONTRATO,
      usuario_id: userId,
    });
  }

  async deleteManyByContractId(
    contratoId: string,
  ): Promise<{ deletedCount: number }> {
    // Asegurarse de que el filtro use ObjectId
    return this.accountingEntryModel.deleteMany({
      contrato_id: new Types.ObjectId(contratoId),
    }) as Promise<{ deletedCount: number }>;
  }

  /**
   * Procesa un recibo completo con múltiples operaciones (cobros y pagos)
   * Permite en un mismo recibo:
   * - Cobrar al locatario (DEBE)
   * - Liquidar al locador (HABER)
   * - Cobrar honorarios al locador (DEBE al locador)
   *
   * Ejemplo de uso:
   * {
   *   lineas: [
   *     { asiento_id: "alquiler_id", tipo_operacion: "COBRO", monto: 1000000 },
   *     { asiento_id: "alquiler_id", tipo_operacion: "PAGO", monto: 920000, agente_id: "locador_id" },
   *     { asiento_id: "honorarios_id", tipo_operacion: "COBRO", monto: 50000 }
   *   ],
   *   cuenta_financiera_id: "caja_id",
   *   fecha: "2025-11-05",
   *   metodo: "transferencia",
   *   usuario_id: "admin_id"
   * }
   *
   * @param dto Datos del recibo con múltiples operaciones
   * @returns Array con los resultados de cada operación procesada
   */
  async processReceipt(dto: ProcessReceiptDto): Promise<any> {
    const resultados = [];
    let montoTotalIngreso = 0;
    let montoTotalEgreso = 0;

    // Procesar cada línea del recibo
    for (const linea of dto.lineas) {
      try {
        let resultado;

        if (linea.tipo_operacion === TipoOperacionRecibo.COBRO) {
          // COBRO: Registrar pago del locatario (DEBE)
          resultado = await this.registerPayment(linea.asiento_id, {
            monto_pagado: linea.monto,
            cuenta_financiera_id: dto.cuenta_financiera_id,
            fecha_pago: dto.fecha,
            metodo_pago: dto.metodo,
            observaciones: linea.concepto || dto.observaciones,
            usuario_id: dto.usuario_id,
          });

          montoTotalIngreso += linea.monto;
        } else if (linea.tipo_operacion === TipoOperacionRecibo.PAGO) {
          // PAGO: Liquidar al locador/inmobiliaria (HABER)
          if (!linea.agente_id) {
            throw new BadRequestException(
              `La línea de PAGO del asiento ${linea.asiento_id} requiere agente_id`,
            );
          }

          resultado = await this.liquidarAPropietario(linea.asiento_id, {
            agente_id: linea.agente_id,
            cuenta_financiera_id: dto.cuenta_financiera_id,
            fecha_liquidacion: dto.fecha,
            metodo_liquidacion: dto.metodo,
            comprobante: dto.comprobante,
            observaciones: linea.concepto || dto.observaciones,
            usuario_id: dto.usuario_id,
          });

          montoTotalEgreso += linea.monto;
        }

        resultados.push({
          asiento_id: linea.asiento_id,
          tipo_operacion: linea.tipo_operacion,
          monto: linea.monto,
          estado: 'PROCESADO',
          resultado,
        });
      } catch (error) {
        resultados.push({
          asiento_id: linea.asiento_id,
          tipo_operacion: linea.tipo_operacion,
          monto: linea.monto,
          estado: 'ERROR',
          error: error.message,
        });
      }
    }

    // Calcular el movimiento neto de caja
    const movimientoNeto = montoTotalIngreso - montoTotalEgreso;

    return {
      recibo: {
        fecha: dto.fecha,
        metodo: dto.metodo,
        comprobante: dto.comprobante,
        observaciones: dto.observaciones,
        total_lineas: dto.lineas.length,
        total_ingreso: montoTotalIngreso,
        total_egreso: montoTotalEgreso,
        movimiento_neto: movimientoNeto,
      },
      operaciones: resultados,
      resumen: {
        procesadas: resultados.filter((r) => r.estado === 'PROCESADO').length,
        errores: resultados.filter((r) => r.estado === 'ERROR').length,
      },
    };
  }
}
