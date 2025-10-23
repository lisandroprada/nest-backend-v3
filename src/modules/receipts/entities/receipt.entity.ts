import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Receipt extends Document {
  @Prop({ required: true, unique: true, index: true })
  numero_recibo: number;

  @Prop({ type: Date, required: true, default: Date.now })
  fecha_emision: Date;

  @Prop({ type: Number, required: true })
  monto_total: number;

  @Prop({ type: String, required: true }) // 'efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro'
  metodo_pago: string;

  @Prop({ type: String }) // Referencia externa, ej. número de transferencia
  comprobante_externo?: string;

  @Prop({ type: Types.ObjectId, ref: 'FinancialAccount', required: true })
  cuenta_financiera_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Agent', required: true }) // Agente que realiza el pago
  agente_id: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'AccountingEntry' }],
    required: true,
  })
  asientos_afectados_ids: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  usuario_emisor_id: Types.ObjectId;

  @Prop({ type: String })
  observaciones?: string;

  @Prop({ type: Types.ObjectId, ref: 'FiscalDocument' }) // Opcional: vincular a una factura
  fiscal_document_id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Contract' }) // Opcional: vincular a un contrato
  contrato_id?: Types.ObjectId;
}

export const ReceiptSchema = SchemaFactory.createForClass(Receipt);
