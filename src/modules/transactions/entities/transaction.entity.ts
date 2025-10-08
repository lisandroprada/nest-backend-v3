import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Transaction extends Document {
  @Prop({ type: Types.ObjectId, ref: 'AccountingEntry', index: true })
  referencia_asiento: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'FinancialAccount', required: true, index: true })
  cuenta_financiera_id: Types.ObjectId;

  @Prop({ type: Date, required: true, index: true, default: Date.now })
  fecha_transaccion: Date;

  @Prop({ type: Number, required: true })
  monto: number;

  @Prop({ type: String, required: true, enum: ['INGRESO', 'EGRESO'] })
  tipo: string;

  @Prop({ type: String })
  descripcion: string;

  @Prop({ type: Boolean, default: false, index: true })
  conciliado: boolean;

  @Prop({ type: Date })
  fecha_conciliacion: Date;

  @Prop({ type: String })
  referencia_bancaria: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_creacion_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_modificacion_id: Types.ObjectId;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
