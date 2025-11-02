import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class FinancialAccount extends Document {
  @Prop({ type: String, required: true, index: true })
  nombre: string;

  @Prop({
    type: String,
    required: true,
    enum: [
      'BANCO_CTA_CTE',
      'BANCO_CAJA_AHORRO',
      'CAJA_EFECTIVO',
      'VALORES_A_DEPOSITAR',
      'CUENTAS_POR_COBRAR',
    ],
    index: true,
  })
  tipo: string;

  @Prop({ type: String, required: true, default: 'ARS' })
  moneda: string; // e.g., 'ARS', 'USD'

  @Prop({ type: String })
  descripcion: string;

  @Prop({ type: Number, default: 0 })
  saldo_inicial: number;

  @Prop({ type: String, enum: ['ACTIVA', 'INACTIVA'], default: 'ACTIVA' })
  status: string;

  // Bank-specific details
  @Prop({ type: String, sparse: true })
  cbu?: string;

  @Prop({ type: String, sparse: true })
  alias?: string;

  @Prop({ type: Types.ObjectId, ref: 'Bank', sparse: true })
  bank_id?: Types.ObjectId; // Reference to the Bank entity

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_creacion_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_modificacion_id: Types.ObjectId;
}

export const FinancialAccountSchema =
  SchemaFactory.createForClass(FinancialAccount);
