import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import {
  ProcessReceiptDto,
  TipoOperacionRecibo,
} from './dto/process-receipt.dto';

@Injectable()
export class AccountingEntriesService {
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
  ) {}

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
        $in: ['PENDIENTE', 'PAGADO_PARCIAL', 'PENDIENTE_AJUSTE'],
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

    const [total, data, breakdownByAccount] = await Promise.all([
      this.accountingEntryModel.countDocuments(query),
      this.accountingEntryModel
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.accountingEntryModel.aggregate(totalsPipeline as PipelineStage[]),
    ]);

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
    } = filters;

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

          // Calcular cuánto se cobró del inquilino (partidas DEBE del asiento)
          const montoCobradoInquilino = asiento.partidas
            .filter((p) => p.debe > 0)
            .reduce((sum, p) => sum + (p.monto_pagado_acumulado || 0), 0);

          // Calcular total HABER del asiento
          const totalHaber = asiento.partidas
            .filter((p) => p.haber > 0)
            .reduce((sum, p) => sum + p.haber, 0);

          // Calcular proporción y monto recaudado disponible para este agente
          const proporcion = totalHaber > 0 ? haber / totalHaber : 0;
          const montoLiquidable = montoCobradoInquilino * proporcion;
          const montoYaLiquidado = partidaAgente.monto_liquidado || 0;
          monto_recaudado_disponible = montoLiquidable - montoYaLiquidado;

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
            monto_cobrado_inquilino: montoCobradoInquilino,
            proporcion: proporcion * 100, // En porcentaje
            monto_liquidable: montoLiquidable,
            monto_ya_liquidado: montoYaLiquidado,
            monto_recaudado_disponible,
            saldo_acumulado: saldo_acumulado_haber,
            estado: asiento.estado,
            fecha_pago: asiento.fecha_pago,
            fecha_liquidacion: asiento.fecha_liquidacion,
            liquidado: monto_recaudado_disponible <= 0,
          });
        }
      }
    }

    return {
      agente_id: agentId,
      resumen: {
        total_debe,
        total_haber,
        total_pagado_debe,
        total_recaudado_haber,
        saldo_pendiente_debe: total_debe - total_pagado_debe,
        saldo_disponible_haber: total_recaudado_haber,
        asientos_pendientes: movimientosConSaldo.filter(
          (m) => m.tipo_partida === 'DEBE' && !m.pagado,
        ).length,
        asientos_pagados: movimientosConSaldo.filter(
          (m) => m.tipo_partida === 'DEBE' && m.pagado,
        ).length,
        asientos_pendientes_liquidacion: movimientosConSaldo.filter(
          (m) => m.tipo_partida === 'HABER' && !m.liquidado,
        ).length,
        asientos_liquidados: movimientosConSaldo.filter(
          (m) => m.tipo_partida === 'HABER' && m.liquidado,
        ).length,
        total_movimientos: movimientosConSaldo.length,
      },
      movimientos: movimientosConSaldo,
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

    if (['PAGADO', 'ANULADO', 'CONDONADO'].includes(asiento.estado)) {
      throw new BadRequestException(
        `El asiento en estado "${asiento.estado}" no puede recibir pagos`,
      );
    }

    const montoPagadoTotalAnterior = asiento.partidas.reduce(
      (sum, p) => sum + (p.monto_pagado_acumulado || 0),
      0,
    );
    const saldoPendiente = asiento.monto_actual - montoPagadoTotalAnterior;

    if (dto.monto_pagado > saldoPendiente) {
      throw new BadRequestException(
        `El monto pagado (${dto.monto_pagado}) excede el saldo pendiente (${saldoPendiente})`,
      );
    }

    // Solo registrar INGRESO (DEBE) como entrada de caja
    const totalDebe = asiento.partidas.reduce((sum, p) => sum + p.debe, 0);
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

    const estadoAnterior = asiento.estado;
    let accionHistorial: string;

    if (nuevoMontoPagadoTotal >= asiento.monto_actual) {
      asiento.estado = 'PAGADO';
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
   * Liquidar a propietario
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

    // Solo se puede liquidar si el inquilino ya pagó (completo o parcial)
    if (!['PAGADO', 'PAGADO_PARCIAL'].includes(asiento.estado)) {
      throw new BadRequestException(
        `Solo se pueden liquidar asientos pagados por el inquilino. Estado actual: ${asiento.estado}`,
      );
    }

    // Calcular cuánto se cobró realmente del inquilino (partidas DEBE)
    const montoCobrado = asiento.partidas
      .filter((p) => p.debe > 0)
      .reduce((sum, p) => sum + (p.monto_pagado_acumulado || 0), 0);

    if (montoCobrado === 0) {
      throw new BadRequestException('No hay monto cobrado para liquidar');
    }

    // Calcular total de partidas HABER
    const totalHaber = asiento.partidas
      .filter((p) => p.haber > 0)
      .reduce((sum, p) => sum + p.haber, 0);

    // CRÍTICO: Filtrar solo las partidas HABER del agente especificado
    const partidasDelAgente = asiento.partidas.filter(
      (p) => p.haber > 0 && p.agente_id?.toString() === dto.agente_id,
    );

    if (partidasDelAgente.length === 0) {
      throw new BadRequestException(
        `No se encontraron partidas HABER para el agente ${dto.agente_id} en este asiento`,
      );
    }

    let montoAPagar = 0;

    // Actualizar SOLO las partidas HABER del agente especificado
    for (const partida of partidasDelAgente) {
      // Proporción de esta partida HABER respecto al total
      const proporcion = totalHaber > 0 ? partida.haber / totalHaber : 0;

      // Monto proporcional según lo cobrado
      const montoProporcionado = montoCobrado * proporcion;

      // Calcular cuánto queda por liquidar (evitar doble imputación)
      const montoYaLiquidado = partida.monto_liquidado || 0;
      const montoDisponible = montoProporcionado - montoYaLiquidado;

      if (montoDisponible <= 0) {
        throw new BadRequestException(
          `La partida del agente ${dto.agente_id} ya está completamente liquidada`,
        );
      }

      // Actualizar el monto liquidado acumulado
      partida.monto_liquidado = montoProporcionado;

      montoAPagar += montoDisponible;
    }

    // Actualizar saldo de la cuenta financiera SOLO si hay pago real (EGRESO)
    if (montoAPagar > 0) {
      await this.financialAccountsService.updateBalance(
        dto.cuenta_financiera_id,
        montoAPagar,
        'EGRESO',
        session,
      );
    }

    // CRÍTICO: NO cambiar estado a LIQUIDADO aquí
    // El asiento puede tener múltiples agentes HABER que se liquidan por separado
    // El estado se actualiza solo si TODAS las partidas HABER están liquidadas
    const todasLiquidadas = asiento.partidas
      .filter((p) => p.haber > 0)
      .every((p) => {
        const proporcion = totalHaber > 0 ? p.haber / totalHaber : 0;
        const montoProporcionado = montoCobrado * proporcion;
        const montoYaLiquidado = p.monto_liquidado || 0;
        return montoYaLiquidado >= montoProporcionado;
      });

    const estadoAnterior = asiento.estado;
    if (todasLiquidadas) {
      asiento.estado = 'LIQUIDADO';
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
      monto: montoAPagar,
      observaciones: `Liquidado al agente ${dto.agente_id}. Método: ${dto.metodo_liquidacion}. Monto cobrado: ${montoCobrado}, Monto liquidado: ${montoAPagar}. ${dto.observaciones || ''}`,
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
