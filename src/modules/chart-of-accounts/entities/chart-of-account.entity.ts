import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ChartOfAccount extends Document {
  @Prop({ type: String, required: true, unique: true, index: true })
  codigo: string;

  @Prop({ type: String, required: true })
  nombre: string;

  @Prop({
    type: String,
    required: true,
    enum: ['ACTIVO', 'PASIVO', 'PATRIMONIO_NETO', 'INGRESO', 'EGRESO'],
    index: true,
  })
  tipo_cuenta: string;

  @Prop({ type: String })
  descripcion: string;

  @Prop({ type: Types.ObjectId, ref: 'ChartOfAccount' })
  cuenta_padre_id: Types.ObjectId;

  @Prop({ type: Boolean, default: true })
  es_imputable: boolean; // Indica si se pueden registrar asientos en esta cuenta

  @Prop({ type: Number, default: 0 })
  tasa_iva_aplicable: number;

  @Prop({ type: Boolean, default: false })
  es_facturable: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_creacion_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_modificacion_id: Types.ObjectId;
}

export const ChartOfAccountSchema =
  SchemaFactory.createForClass(ChartOfAccount);
