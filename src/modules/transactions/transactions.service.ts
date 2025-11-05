import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Transaction } from './entities/transaction.entity';
import { AccountingEntriesService } from '../accounting-entries/accounting-entries.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { LiquidateDto } from './dto/liquidate.dto';
import { ReceiptsService } from '../receipts/receipts.service';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
    private readonly accountingEntriesService: AccountingEntriesService,
    @Inject(forwardRef(() => ReceiptsService))
    private readonly receiptsService: ReceiptsService,
  ) {}

  async create(
    createTransactionDto: CreateTransactionDto,
    userId: string,
    session: any, // Mongoose session
  ): Promise<Transaction> {
    const newTransaction = new this.transactionModel({
      ...createTransactionDto,
      usuario_creacion_id: new Types.ObjectId(userId),
      usuario_modificacion_id: new Types.ObjectId(userId),
    });
    return await newTransaction.save({ session });
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

    if (!transaction.receipt_id) {
      throw new NotFoundException(
        `Transaction with ID ${transactionId} is not associated with a receipt.`,
      );
    }

    const receipt = await this.receiptsService.findOne(
      transaction.receipt_id.toString(),
    );
    if (!receipt) {
      throw new NotFoundException(
        `Receipt with ID ${transaction.receipt_id} not found.`,
      );
    }

    // Aquí podrías poblar más datos del recibo si fuera necesario (agente, asientos, etc.)
    // Por ahora, devolvemos la información básica del recibo.
    return receipt;
  }

  async getAgentPendingLiquidation(agentId: string) {
    return this.accountingEntriesService.getAgentPendingLiquidation(agentId);
  }

  async calculateAgentBalance(agentId: string) {
    return this.accountingEntriesService.calculateAgentBalance(agentId);
  }
}
