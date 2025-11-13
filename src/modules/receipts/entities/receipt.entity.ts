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
    type: [
      {
        asiento_id: { type: Types.ObjectId, ref: 'AccountingEntry' },
        monto_imputado: { type: Number },
        tipo_operacion: { type: String, enum: ['COBRO', 'PAGO'] },
      },
    ],
    required: true,
  })
  asientos_afectados: Array<{
    asiento_id: Types.ObjectId;
    monto_imputado: number;
    tipo_operacion?: 'COBRO' | 'PAGO';
  }>;

  // DEPRECATED: Mantener por compatibilidad, pero usar asientos_afectados
  @Prop({
    type: [{ type: Types.ObjectId, ref: 'AccountingEntry' }],
    required: false,
  })
  asientos_afectados_ids?: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  usuario_emisor_id: Types.ObjectId;

  @Prop({ type: String })
  observaciones?: string;

  @Prop({ type: Types.ObjectId, ref: 'FiscalDocument' }) // Opcional: vincular a una factura
  fiscal_document_id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Contract' }) // Opcional: vincular a un contrato
  contrato_id?: Types.ObjectId;

  @Prop({ type: String }) // Tipo de flujo: INGRESO o EGRESO
  tipo_flujo_neto?: string;

  @Prop({ type: String }) // Ruta del archivo PDF generado
  pdf_path?: string;

  @Prop({ type: String }) // URL pública del PDF (si aplica)
  pdf_url?: string;

  @Prop({ type: Types.ObjectId, ref: 'AccountingEntry' }) // Asiento de saldo a favor (si aplica)
  saldo_a_favor_entry_id?: Types.ObjectId;
}

export const ReceiptSchema = SchemaFactory.createForClass(Receipt);

// Indexes para mejorar performance de listados por agente y filtros comunes
ReceiptSchema.index({ agente_id: 1, fecha_emision: -1 });
ReceiptSchema.index({ tipo_flujo_neto: 1 });
ReceiptSchema.index({ fecha_emision: -1 });
