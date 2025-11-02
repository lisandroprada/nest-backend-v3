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
    const { fecha_desde, fecha_hasta, incluir_anulados = false } = filters;

    const matchStage: any = { 'partidas.agente_id': agentId };
    if (!incluir_anulados) {
      matchStage.estado = { $nin: ['ANULADO', 'CONDONADO'] };
    }

    if (fecha_desde || fecha_hasta) {
      matchStage.fecha_imputacion = {};
      if (fecha_desde) {
        matchStage.fecha_imputacion.$gte = new Date(fecha_desde);
      }
      if (fecha_hasta) {
        matchStage.fecha_imputacion.$lte = new Date(fecha_hasta);
      }
    }

    const pipeline = [
      { $match: matchStage },
      { $unwind: '$partidas' },
      { $match: { 'partidas.agente_id': agentId } },
      { $sort: { fecha_imputacion: 1 } },
    ];

    const movimientos = await this.accountingEntryModel.aggregate(
      pipeline as PipelineStage[],
    );

    let saldo_acumulado = 0;
    let total_debe = 0;
    let total_haber = 0;
    let total_pagado = 0;

    const movimientosConSaldo = movimientos.map((m) => {
      const debe = m.partidas.debe || 0;
      const haber = m.partidas.haber || 0;
      const pagado = m.partidas.monto_pagado_acumulado || 0;

      saldo_acumulado += debe - haber;
      total_debe += debe;
      total_haber += haber;
      total_pagado += pagado;

      return {
        ...m,
        debe,
        haber,
        monto_pagado_acumulado: pagado,
        saldo_partida: debe - pagado,
        saldo_acumulado,
        pagado:
          m.estado === 'PAGADO' ||
          (m.estado === 'PAGADO_PARCIAL' && pagado >= debe),
      };
    });

    return {
      agente_id: agentId,
      resumen: {
        total_debe,
        total_haber,
        total_pagado,
        saldo_final: total_debe - total_haber,
        asientos_pendientes: movimientosConSaldo.filter((m) => !m.pagado)
          .length,
        asientos_pagados: movimientosConSaldo.filter((m) => m.pagado).length,
        total_movimientos: movimientos.length,
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
    const pipeline = [
      {
        $match: {
          estado: { $in: ['PAGADO', 'PAGADO_PARCIAL'] },
        },
      },
      { $unwind: '$partidas' },
      {
        $match: {
          'partidas.agente_id': agentId,
          'partidas.haber': { $gt: 0 },
        },
      },
      {
        $project: {
          _id: 0,
          fecha_cobro: '$updatedAt',
          descripcion: '$partidas.descripcion',
          monto_a_liquidar: '$partidas.haber',
          asiento_id: '$_id',
          contrato_id: '$contrato_id',
        },
      },
    ];
    return this.accountingEntryModel.aggregate(pipeline);
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
    const cutoff = fechaCorte ? new Date(fechaCorte) : new Date();
    // El pipeline filtra por fecha_vencimiento <= cutoff y agente_id como string
    const pipeline = [
      // 1. Filtrar asientos relevantes para el agente, no anulados/condonados y vencidos hasta la fecha de corte
      {
        $match: {
          'partidas.agente_id': agenteId,
          estado: { $nin: ['ANULADO', 'CONDONADO'] },
          fecha_imputacion: { $lte: cutoff },
        },
      },
      // 2. Desenrollar el array de partidas
      { $unwind: '$partidas' },
      // 3. Filtrar solo las partidas que pertenecen al agente
      {
        $match: {
          'partidas.agente_id': agenteId,
        },
      },
      // 4. Calcular el débito pendiente y el crédito pendiente para cada partida
      {
        $project: {
          deuda_pendiente: {
            $subtract: [
              { $ifNull: ['$partidas.debe', 0] },
              { $ifNull: ['$partidas.monto_pagado_acumulado', 0] },
            ],
          },
          credito_pendiente: {
            $cond: {
              // Si el asiento fue liquidado, el crédito ya no está pendiente
              if: { $eq: ['$estado', 'LIQUIDADO'] },
              then: 0,
              // De lo contrario, el crédito completo está pendiente
              else: { $ifNull: ['$partidas.haber', 0] },
            },
          },
        },
      },
      // 5. Agrupar todas las partidas para obtener los totales
      {
        $group: {
          _id: null,
          total_deuda: { $sum: '$deuda_pendiente' },
          total_credito: { $sum: '$credito_pendiente' },
        },
      },
      // 6. Calcular el balance final
      {
        $project: {
          _id: 0,
          balance: { $subtract: ['$total_deuda', '$total_credito'] },
        },
      },
    ];

    const result = await this.accountingEntryModel.aggregate(pipeline);
    if (result.length > 0) {
      return result[0].balance;
    }
    return 0;
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

    let montoRestanteAPagar = dto.monto_pagado;
    for (const partida of asiento.partidas) {
      if (partida.debe > 0 && montoRestanteAPagar > 0) {
        const deudaPartida = partida.debe - (partida.monto_pagado_acumulado || 0);
        if (deudaPartida > 0) {
          const montoAImputar = Math.min(montoRestanteAPagar, deudaPartida);
          partida.monto_pagado_acumulado =
            (partida.monto_pagado_acumulado || 0) + montoAImputar;
          montoRestanteAPagar -= montoAImputar;
        }
      }
    }

    const nuevoMontoPagadoTotal = asiento.partidas.reduce(
      (sum, p) => sum + (p.monto_pagado_acumulado || 0),
      0,
    );

    const estadoAnterior = asiento.estado;
    let accionHistorial: string;

    if (nuevoMontoPagadoTotal >= asiento.monto_actual) {
      asiento.estado = 'PAGADO';
      asiento.fecha_pago = new Date(dto.fecha_pago);
      asiento.metodo_pago = dto.metodo_pago;
      asiento.comprobante = dto.comprobante;
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

    // Solo se puede liquidar si el inquilino ya pagó
    if (asiento.estado !== 'PAGADO') {
      throw new BadRequestException(
        `Solo se pueden liquidar asientos pagados por el inquilino. Estado actual: ${asiento.estado}`,
      );
    }

    // Actualizar estado
    asiento.estado = 'LIQUIDADO';
    asiento.fecha_liquidacion = new Date(dto.fecha_liquidacion);
    asiento.metodo_liquidacion = dto.metodo_liquidacion;
    asiento.comprobante_liquidacion = dto.comprobante;

    // Registrar en historial
    asiento.historial_cambios.push({
      fecha: new Date(),
      usuario_id: new Types.ObjectId(dto.usuario_id),
      accion: 'LIQUIDACION',
      estado_anterior: 'PAGADO',
      estado_nuevo: 'LIQUIDADO',
      observaciones: `Liquidado al propietario. Método: ${dto.metodo_liquidacion}. ${dto.observaciones || ''}`,
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
}
