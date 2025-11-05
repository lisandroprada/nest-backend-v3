import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum CashBoxMovementType {
  OPENING = 'OPENING',
  PARTIAL_CLOSURE = 'PARTIAL_CLOSURE',
  FINAL_CLOSURE = 'FINAL_CLOSURE',
  CASH_DEPOSIT = 'CASH_DEPOSIT', // Ej. depósito de efectivo a un banco
  CASH_WITHDRAWAL = 'CASH_WITHDRAWAL', // Ej. retiro de efectivo del banco a la caja
  ADJUSTMENT = 'ADJUSTMENT', // Para ajustes manuales o por discrepancia
}

@Schema({ timestamps: true })
export class CashBoxMovement extends Document {
  @Prop({ type: Types.ObjectId, ref: 'FinancialAccount', required: true })
  financial_account_id: Types.ObjectId; // La caja de efectivo afectada

  @Prop({ type: String, enum: CashBoxMovementType, required: true })
  type: CashBoxMovementType;

  @Prop({ type: Date, required: true, default: Date.now })
  timestamp: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user_id: Types.ObjectId; // Operador que realiza el movimiento

  @Prop({ type: Number })
  declared_amount?: number; // Monto declarado en la apertura

  @Prop({ type: Number })
  physical_count?: number; // Conteo físico en cierres

  @Prop({ type: Number })
  expected_balance_at_closure?: number; // Saldo esperado por el sistema al momento del cierre

  @Prop({ type: Number })
  discrepancy?: number; // Diferencia entre physical_count y expected_balance

  @Prop({ type: Types.ObjectId, ref: 'AccountingEntry' })
  adjustment_entry_id?: Types.ObjectId; // Referencia al asiento de ajuste si hubo discrepancia

  @Prop({ type: Types.ObjectId, ref: 'Receipt' })
  receipt_id?: Types.ObjectId; // Si el movimiento está vinculado a un recibo (ej. un ingreso de efectivo)

  @Prop({ type: String })
  notes?: string; // Notas adicionales del operador
}

export const CashBoxMovementSchema =
  SchemaFactory.createForClass(CashBoxMovement);
