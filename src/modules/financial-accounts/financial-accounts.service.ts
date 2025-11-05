import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FinancialAccount } from './entities/financial-account.entity';
import { CreateFinancialAccountDto } from './dto/create-financial-account.dto';
import { UpdateFinancialAccountDto } from './dto/update-financial-account.dto';
import { Transaction } from '../transactions/entities/transaction.entity';
import { MovementsQueryDto } from './dto/movements-query.dto';

@Injectable()
export class FinancialAccountsService {
  constructor(
    @InjectModel(FinancialAccount.name)
    private readonly financialAccountModel: Model<FinancialAccount>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
  ) {}

  async create(
    createDto: CreateFinancialAccountDto,
  ): Promise<FinancialAccount> {
    const newAccount = new this.financialAccountModel(createDto);
    return await newAccount.save();
  }

  async findAll(): Promise<FinancialAccount[]> {
    return await this.financialAccountModel.find().exec();
  }

  async findOne(id: string): Promise<FinancialAccount> {
    const account = await this.financialAccountModel.findById(id);
    if (!account) {
      throw new NotFoundException(
        `Cuenta financiera con ID "${id}" no encontrada.`,
      );
    }
    return account;
  }

  async update(
    id: string,
    updateDto: UpdateFinancialAccountDto,
  ): Promise<FinancialAccount> {
    const updatedAccount = await this.financialAccountModel.findByIdAndUpdate(
      id,
      updateDto,
      { new: true },
    );
    if (!updatedAccount) {
      throw new NotFoundException(
        `Cuenta financiera con ID "${id}" no encontrada.`,
      );
    }
    return updatedAccount;
  }

  async remove(id: string): Promise<{ deleted: boolean; message?: string }> {
    const result = await this.financialAccountModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException(
        `Cuenta financiera con ID "${id}" no encontrada.`,
      );
    }
    return { deleted: true };
  }

  async updateBalance(
    accountId: string,
    amount: number,
    type: 'INGRESO' | 'EGRESO' | 'SET',
    session: any, // Mongoose session
  ): Promise<FinancialAccount> {
    let update: any;
    if (type === 'INGRESO') {
      update = { $inc: { saldo_inicial: amount } };
    } else if (type === 'EGRESO') {
      update = { $inc: { saldo_inicial: -amount } };
    } else if (type === 'SET') {
      update = { $set: { saldo_inicial: amount } };
    } else {
      throw new BadRequestException(`Invalid movement type: ${type}`);
    }

    const updatedAccount = await this.financialAccountModel.findByIdAndUpdate(
      accountId,
      update,
      { new: true, session },
    );

    if (!updatedAccount) {
      throw new NotFoundException(
        `Cuenta financiera con ID "${accountId}" no encontrada para actualizar el saldo.`,
      );
    }
    return updatedAccount;
  }

  /**
   * Obtiene los movimientos (transacciones) de cuentas financieras
   * con paginación y filtros
   */
  async getMovements(query: MovementsQueryDto) {
    const {
      cuenta_financiera_id,
      fecha_desde,
      fecha_hasta,
      tipo,
      conciliado,
      page = 0,
      pageSize = 10,
      sort = '-fecha_transaccion',
    } = query;

    // Construir filtros
    const filter: any = {};

    if (cuenta_financiera_id) {
      filter.cuenta_financiera_id = cuenta_financiera_id;
    }

    if (tipo) {
      filter.tipo = tipo;
    }

    if (conciliado !== undefined) {
      filter.conciliado = conciliado === 'true';
    }

    if (fecha_desde || fecha_hasta) {
      filter.fecha_transaccion = {};
      if (fecha_desde) {
        filter.fecha_transaccion.$gte = new Date(fecha_desde);
      }
      if (fecha_hasta) {
        // Incluir todo el día hasta las 23:59:59
        const fechaHasta = new Date(fecha_hasta);
        fechaHasta.setHours(23, 59, 59, 999);
        filter.fecha_transaccion.$lte = fechaHasta;
      }
    }

    // Ejecutar query con paginación
    const [movimientos, total] = await Promise.all([
      this.transactionModel
        .find(filter)
        .populate('cuenta_financiera_id', 'nombre tipo moneda')
        .populate('referencia_asiento', 'concepto monto_original')
        .populate('usuario_creacion_id', 'username email')
        .sort(sort)
        .skip(page * pageSize)
        .limit(pageSize)
        .lean()
        .exec(),
      this.transactionModel.countDocuments(filter),
    ]);

    // Calcular totales del período
    const [totales] = await this.transactionModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          total_ingresos: {
            $sum: {
              $cond: [{ $eq: ['$tipo', 'INGRESO'] }, '$monto', 0],
            },
          },
          total_egresos: {
            $sum: {
              $cond: [{ $eq: ['$tipo', 'EGRESO'] }, '$monto', 0],
            },
          },
          cantidad_ingresos: {
            $sum: {
              $cond: [{ $eq: ['$tipo', 'INGRESO'] }, 1, 0],
            },
          },
          cantidad_egresos: {
            $sum: {
              $cond: [{ $eq: ['$tipo', 'EGRESO'] }, 1, 0],
            },
          },
        },
      },
    ]);

    const resumenTotales = totales || {
      total_ingresos: 0,
      total_egresos: 0,
      cantidad_ingresos: 0,
      cantidad_egresos: 0,
    };

    return {
      data: movimientos,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      resumen: {
        total_ingresos: resumenTotales.total_ingresos,
        total_egresos: resumenTotales.total_egresos,
        flujo_neto:
          resumenTotales.total_ingresos - resumenTotales.total_egresos,
        cantidad_ingresos: resumenTotales.cantidad_ingresos,
        cantidad_egresos: resumenTotales.cantidad_egresos,
      },
      filtros_aplicados: {
        cuenta_financiera_id,
        fecha_desde,
        fecha_hasta,
        tipo,
        conciliado,
      },
    };
  }
}
