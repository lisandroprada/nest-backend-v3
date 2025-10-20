import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class FiscalDocument extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Agent', required: true, index: true })
  agente_cliente_id: Types.ObjectId;

  @Prop({ type: String, required: true })
  tipo_comprobante: string;

  @Prop({ type: Number, required: true })
  numero_comprobante: number;

  @Prop({ type: Number, required: true })
  punto_venta: number;

  @Prop({ type: Date, required: true })
  fecha_emision: Date;

  @Prop({ type: Number, required: true })
  monto_total_fiscal: number;

  @Prop({ type: String, required: true, unique: true })
  CAE: string;

  @Prop({
    type: String,
    enum: ['APROBADO', 'RECHAZADO', 'PENDIENTE'],
    required: true,
  })
  estado_AFIP: string;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'AccountingEntry' }],
    required: true,
  })
  asientos_asociados_ids: Types.ObjectId[];

  @Prop({ type: Object })
  detalles_errores: any;
}

export const FiscalDocumentSchema =
  SchemaFactory.createForClass(FiscalDocument);
