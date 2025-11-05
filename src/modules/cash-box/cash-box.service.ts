import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CashBoxMovement,
  CashBoxMovementType,
} from './entities/cash-box-movement.entity';
import { CreateCashBoxMovementDto } from './dto/create-cash-box-movement.dto';
import { FinancialAccountsService } from '../financial-accounts/financial-accounts.service';
import { AccountingEntriesService } from '../accounting-entries/accounting-entries.service';

@Injectable()
export class CashBoxService {
  constructor(
    @InjectModel(CashBoxMovement.name)
    private readonly cashBoxMovementModel: Model<CashBoxMovement>,
    private readonly financialAccountsService: FinancialAccountsService,
    private readonly accountingEntriesService: AccountingEntriesService,
  ) {}

  async getExpectedBalance(financialAccountId: string): Promise<number> {
    const financialAccount =
      await this.financialAccountsService.findOne(financialAccountId);
    if (!financialAccount) {
      throw new NotFoundException(
        `Financial account with ID "${financialAccountId}" not found.`,
      );
    }
    if (financialAccount.tipo !== 'CAJA_EFECTIVO') {
      throw new BadRequestException(
        `Financial account with ID "${financialAccount.id}" is not a cash box (CAJA_EFECTIVO).`,
      );
    }
    return financialAccount.saldo_inicial;
  }

  async createOpening(
    createDto: CreateCashBoxMovementDto,
    user_id: string,
  ): Promise<CashBoxMovement> {
    const { financial_account_id, declared_amount, notes } = createDto;

    if (createDto.type !== CashBoxMovementType.OPENING) {
      throw new BadRequestException(
        'This method is only for creating an OPENING movement.',
      );
    }

    if (declared_amount === undefined || declared_amount < 0) {
      throw new BadRequestException(
        'Declared amount is required and must be non-negative for an opening movement.',
      );
    }

    const financialAccount =
      await this.financialAccountsService.findOne(financial_account_id);
    if (!financialAccount) {
      throw new NotFoundException(
        `Financial account with ID "${financial_account_id}" not found.`,
      );
    }
    if (financialAccount.tipo !== 'CAJA_EFECTIVO') {
      throw new BadRequestException(
        `Financial account with ID "${financial_account_id}" is not a cash box (CAJA_EFECTIVO).`,
      );
    }

    // Check if there's an open cash box for this financial account
    const lastMovement = await this.cashBoxMovementModel.findOne(
      { financial_account_id: new Types.ObjectId(financial_account_id) },
      {}, // No specific fields needed
      { sort: { timestamp: -1 } }, // Get the latest movement
    );

    if (
      lastMovement &&
      lastMovement.type !== CashBoxMovementType.FINAL_CLOSURE
    ) {
      throw new BadRequestException(
        `Cash box for financial account ID "${financial_account_id}" is already open or not properly closed.`,
      );
    }

    // Update financial account balance
    await this.financialAccountsService.updateBalance(
      financial_account_id,
      declared_amount,
      'SET',
      null, // Pass null for session
    );

    const newMovement = new this.cashBoxMovementModel({
      financial_account_id: new Types.ObjectId(financial_account_id),
      type: CashBoxMovementType.OPENING,
      user_id: new Types.ObjectId(user_id),
      declared_amount,
      notes,
      timestamp: new Date(),
    });

    return (await newMovement.save()).toObject();
  }

  async createPartialClosure(
    createDto: CreateCashBoxMovementDto,
    user_id: string,
  ): Promise<CashBoxMovement> {
    const { financial_account_id, physical_count, notes } = createDto;

    if (createDto.type !== CashBoxMovementType.PARTIAL_CLOSURE) {
      throw new BadRequestException(
        'This method is only for creating a PARTIAL_CLOSURE movement.',
      );
    }

    if (physical_count === undefined || physical_count < 0) {
      throw new BadRequestException(
        'Physical count is required and must be non-negative for a partial closure movement.',
      );
    }

    const financialAccount =
      await this.financialAccountsService.findOne(financial_account_id);
    if (!financialAccount) {
      throw new NotFoundException(
        `Financial account with ID "${financial_account_id}" not found.`,
      );
    }
    if (financialAccount.tipo !== 'CAJA_EFECTIVO') {
      throw new BadRequestException(
        `Financial account with ID "${financial_account_id}" is not a cash box (CAJA_EFECTIVO).`,
      );
    }

    const expected_balance = financialAccount.saldo_inicial;
    const discrepancy = physical_count - expected_balance;

    const newMovement = new this.cashBoxMovementModel({
      financial_account_id: new Types.ObjectId(financial_account_id),
      type: CashBoxMovementType.PARTIAL_CLOSURE,
      user_id: new Types.ObjectId(user_id),
      physical_count,
      expected_balance_at_closure: expected_balance,
      discrepancy,
      notes,
      timestamp: new Date(),
    });

    return (await newMovement.save()).toObject();
  }

  async createFinalClosure(
    createDto: CreateCashBoxMovementDto,
    user_id: string,
  ): Promise<CashBoxMovement> {
    const { financial_account_id, physical_count, notes } = createDto;

    if (createDto.type !== CashBoxMovementType.FINAL_CLOSURE) {
      throw new BadRequestException(
        'This method is only for creating a FINAL_CLOSURE movement.',
      );
    }

    if (physical_count === undefined || physical_count < 0) {
      throw new BadRequestException(
        'Physical count is required and must be non-negative for a final closure movement.',
      );
    }

    const financialAccount =
      await this.financialAccountsService.findOne(financial_account_id);
    if (!financialAccount) {
      throw new NotFoundException(
        `Financial account with ID "${financial_account_id}" not found.`,
      );
    }
    if (financialAccount.tipo !== 'CAJA_EFECTIVO') {
      throw new BadRequestException(
        `Financial account with ID "${financial_account_id}" is not a cash box (CAJA_EFECTIVO).`,
      );
    }

    const expected_balance = financialAccount.saldo_inicial;
    const discrepancy = physical_count - expected_balance;
    let adjustmentEntryId: Types.ObjectId | undefined;

    if (discrepancy !== 0) {
      // Create an accounting entry for the discrepancy
      const description =
        discrepancy > 0 ? 'Sobrante de Caja' : 'Faltante de Caja';
      const amount = Math.abs(discrepancy);

      // Determine debit/credit based on discrepancy
      // If discrepancy > 0 (sobrante), cash increases (debit), other account (e.g., income) increases (credit)
      // If discrepancy < 0 (faltante), cash decreases (credit), other account (e.g., expense) increases (debit)
      const debitAmount = discrepancy < 0 ? amount : 0;
      const creditAmount = discrepancy > 0 ? amount : 0;

      const chartOfAccountsIdForDiscrepancy = '60c72b2f9b1d8e001c8a4f1d'; // Placeholder

      const adjustmentEntry = await this.accountingEntriesService.create({
        contrato_id: undefined,
        fecha_imputacion: new Date(),
        fecha_vencimiento: new Date(),
        descripcion: `${description} - ${financialAccount.nombre}`,
        tipo_asiento: 'AJUSTE_CAJA',
        estado: 'PAGADO',
        monto_original: amount,
        monto_actual: amount,
        partidas: [
          {
            cuenta_id: new Types.ObjectId(financialAccount.id),
            descripcion: description,
            debe: debitAmount,
            haber: creditAmount,
            agente_id: undefined,
            es_iva_incluido: false,
            tasa_iva_aplicada: 0,
            monto_base_imponible: 0,
            monto_iva_calculado: 0,
          },
          {
            cuenta_id: new Types.ObjectId(chartOfAccountsIdForDiscrepancy),
            descripcion: description,
            debe: creditAmount,
            haber: debitAmount,
            agente_id: undefined,
            es_iva_incluido: false,
            tasa_iva_aplicada: 0,
            monto_base_imponible: 0,
            monto_iva_calculado: 0,
          },
        ],
        usuario_creacion_id: new Types.ObjectId(user_id),
      });
      adjustmentEntryId = new Types.ObjectId(adjustmentEntry.id);
    }

    // Update financial account balance to match physical count
    await this.financialAccountsService.updateBalance(
      financial_account_id,
      physical_count,
      'SET',
      null, // Pass null for session
    );

    const newMovement = new this.cashBoxMovementModel({
      financial_account_id: new Types.ObjectId(financial_account_id),
      type: CashBoxMovementType.FINAL_CLOSURE,
      user_id: new Types.ObjectId(user_id),
      physical_count,
      expected_balance_at_closure: expected_balance,
      discrepancy,
      adjustment_entry_id: adjustmentEntryId,
      notes,
      timestamp: new Date(),
    });

    return (await newMovement.save()).toObject();
  }
}
