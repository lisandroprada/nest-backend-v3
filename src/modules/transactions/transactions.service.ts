import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Transaction } from './entities/transaction.entity';
import { AccountingEntriesService } from '../accounting-entries/accounting-entries.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { LiquidateDto } from './dto/liquidate.dto';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
    private readonly accountingEntriesService: AccountingEntriesService, // Inyección clave
  ) {}

  async createTransactionAndImpute(
    createTransactionDto: CreateTransactionDto,
    userId: string,
  ): Promise<Transaction> {
    // 1. Guardar la transacción (registro de flujo de caja)
    const newTransaction = new this.transactionModel({
      ...createTransactionDto,
      usuario_creacion_id: new Types.ObjectId(userId),
      usuario_modificacion_id: new Types.ObjectId(userId),
    });
    await newTransaction.save();

    // 2. Imputar el pago al asiento contable (Lógica central de cobro)
    const { referencia_asiento, monto } = createTransactionDto;

    // Imputar el pago usando el método correcto
    await this.accountingEntriesService.marcarComoPagado(referencia_asiento, {
      monto_pagado: monto,
      fecha_pago: new Date().toISOString(),
      metodo_pago: 'TRANSFERENCIA', // Ajustar según contexto
      comprobante: '',
      usuario_id: userId,
      observaciones: 'Imputación automática desde transacción',
    });

    return newTransaction;
  }

  async liquidate(
    liquidateDto: LiquidateDto,
    userId: string,
  ): Promise<Transaction> {
    const {
      locador_id,
      cuenta_financiera_id,
      asientos_a_liquidar,
      monto_total,
      fecha_pago,
    } = liquidateDto;

    // 1. Create EGRESO transaction
    const newTransaction = new this.transactionModel({
      cuenta_financiera_id,
      monto: monto_total,
      fecha_transaccion: fecha_pago,
      tipo: 'EGRESO',
      descripcion: `Liquidación a locador ${locador_id}`,
      usuario_creacion_id: new Types.ObjectId(userId),
      usuario_modificacion_id: new Types.ObjectId(userId),
    });
    await newTransaction.save();

    // 2. Mark accounting entries as LIQUIDADO
    await this.accountingEntriesService.markAsLiquidated(asientos_a_liquidar);

    return newTransaction;
  }

  async getReceipt(transactionId: string): Promise<any> {
    const transaction = await this.transactionModel.findById(transactionId);
    if (!transaction) {
      throw new NotFoundException(
        `Transaction with ID ${transactionId} not found.`,
      );
    }

    const accountingEntry = await this.accountingEntriesService[
      'accountingEntryModel'
    ].findById(transaction.referencia_asiento.toString());
    if (!accountingEntry) {
      throw new NotFoundException(
        `Accounting entry with ID ${transaction.referencia_asiento} not found.`,
      );
    }

    return {
      receipt_id: transaction._id,
      date: transaction.fecha_transaccion,
      amount: transaction.monto,
      concept: accountingEntry.descripcion,
      message:
        'This is a placeholder for the receipt. PDF generation should be implemented here.',
    };
  }

  async getAgentPendingLiquidation(agentId: string) {
    return this.accountingEntriesService.getAgentPendingLiquidation(agentId);
  }

  async calculateAgentBalance(agentId: string) {
    return this.accountingEntriesService.calculateAgentBalance(agentId);
  }
}
