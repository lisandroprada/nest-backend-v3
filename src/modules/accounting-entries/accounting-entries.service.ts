import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccountingEntry } from './entities/accounting-entry.entity';
import { CreateAccountingEntryDto } from './dto/create-accounting-entry.dto';
import { PaginationService } from 'src/common/pagination/pagination.service';
import { PaginationDto } from 'src/common/pagination/dto/pagination.dto';

@Injectable()
export class AccountingEntriesService {
  constructor(
    @InjectModel(AccountingEntry.name)
    private readonly accountingEntryModel: Model<AccountingEntry>,
    private readonly paginationService: PaginationService,
  ) {}

  async create(
    createAccountingEntryDto: CreateAccountingEntryDto,
  ): Promise<AccountingEntry> {
    const { partidas, usuario_creacion_id, usuario_modificacion_id } = createAccountingEntryDto;

    const totalDebe = partidas.reduce((sum, p) => sum + (p.debe || 0), 0);
    const totalHaber = partidas.reduce((sum, p) => sum + (p.haber || 0), 0);

    if (Math.abs(totalDebe - totalHaber) > 0.01) {
      throw new BadRequestException(
        'El asiento no está balanceado: la suma de débitos no es igual a la suma de créditos.',
      );
    }

    const nuevoAsiento = new this.accountingEntryModel({
      ...createAccountingEntryDto,
      estado: 'PENDIENTE',
      monto_original: totalDebe,
      monto_actual: totalDebe,
      usuario_creacion_id,
      usuario_modificacion_id,
    });

    return await nuevoAsiento.save();
  }

  async findById(id: string): Promise<AccountingEntry> {
    return this.accountingEntryModel.findById(id);
  }

  async findAll(paginationDto: PaginationDto) {
    return this.paginationService.paginate(this.accountingEntryModel, paginationDto);
  }

  async findEntriesDetailByAgent(agentId: string, paginationDto: PaginationDto) {
    const query = { 'partidas.agente_id': new Types.ObjectId(agentId) };
    return this.paginationService.paginate(this.accountingEntryModel, paginationDto, query);
  }

  async getAgingReport(queryParams: any) {
    // Placeholder for aging report logic
    return {
      message: 'Aging report endpoint not implemented yet.',
      queryParams,
    };
  }

  async getAccruedIncome(queryParams: any) {
    // Placeholder for accrued income logic
    return {
      message: 'Accrued income endpoint not implemented yet.',
      queryParams,
    };
  }

  async imputePayment(
    asientoId: string,
    montoPago: number,
  ): Promise<AccountingEntry> {
    const asiento = await this.accountingEntryModel.findById(asientoId);

    if (!asiento) {
      throw new NotFoundException(
        `Asiento contable con ID "${asientoId}" no encontrado.`,
      );
    }

    if (['PAGADO', 'ANULADO', 'CONDONADO'].includes(asiento.estado)) {
      throw new BadRequestException(
        `No se puede imputar un pago a un asiento en estado "${asiento.estado}".`,
      );
    }

    let pagoRestante = montoPago;
    let montoTotalPagado = 0;

    for (const partida of asiento.partidas) {
      if (partida.debe > 0 && pagoRestante > 0) {
        const deudaPartida =
          partida.debe - (partida.monto_pagado_acumulado || 0);
        if (deudaPartida > 0) {
          const montoAImputar = Math.min(pagoRestante, deudaPartida);
          partida.monto_pagado_acumulado =
            (partida.monto_pagado_acumulado || 0) + montoAImputar;
          pagoRestante -= montoAImputar;
        }
      }
      if (partida.debe > 0) {
        montoTotalPagado += partida.monto_pagado_acumulado || 0;
      }
    }

    if (montoTotalPagado >= asiento.monto_actual) {
      asiento.estado = 'PAGADO';
      if (pagoRestante > 0.01) {
        console.warn(
          `ADVERTENCIA: Pago excedente de ${pagoRestante} en asiento ${asientoId}. La creación de saldo a favor no está implementada.`,
        );
      }
    } else if (montoTotalPagado > 0) {
      asiento.estado = 'PAGADO_PARCIAL';
    }

    return await asiento.save();
  }

  async getAgentPendingLiquidation(agentId: string): Promise<any[]> {
    const objectId = new Types.ObjectId(agentId);
    const pipeline = [
      {
        $match: {
          estado: { $in: ['PAGADO', 'PAGADO_PARCIAL'] },
        },
      },
      { $unwind: '$partidas' },
      {
        $match: {
          $expr: { $eq: [{ $toObjectId: '$partidas.agente_id' }, objectId] },
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

  async find(filter: any): Promise<AccountingEntry[]> {
    return this.accountingEntryModel.find(filter).exec();
  }

  async markAsInvoiced(asientoIds: string[]) {
    return this.accountingEntryModel.updateMany(
      { _id: { $in: asientoIds } },
      { $set: { estado: 'FACTURADO' } },
    );
  }

  async markAsLiquidated(asientoIds: string[]) {
    return this.accountingEntryModel.updateMany(
      { _id: { $in: asientoIds } },
      { $set: { estado: 'LIQUIDADO' } },
    );
  }

  async calculateAgentBalance(agenteId: string): Promise<number> {
    const objectId = new Types.ObjectId(agenteId);

    const pipeline = [
      // 1. Filtrar asientos relevantes para el agente y que no estén anulados/condonados
      {
        $match: {
          'partidas.agente_id': objectId,
          estado: { $nin: ['ANULADO', 'CONDONADO'] },
        },
      },
      // 2. Desenrollar el array de partidas
      { $unwind: '$partidas' },
      // 3. Filtrar solo las partidas que pertenecen al agente
      {
        $match: {
          'partidas.agente_id': objectId,
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
}