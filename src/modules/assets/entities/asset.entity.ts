import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
class HistorialEstado {
  @Prop({ type: Date, required: true })
  fecha: Date;

  @Prop({
    type: String,
    enum: ['NUEVO', 'BUENO', 'DESGASTE', 'DAÑADO', 'EN_REPARACION'],
    required: true,
  })
  estado_item: string;

  @Prop({ type: Types.ObjectId, ref: 'Contract' })
  contrato_id: Types.ObjectId;

  @Prop({ type: String })
  observaciones: string;
}
const HistorialEstadoSchema = SchemaFactory.createForClass(HistorialEstado);

@Schema({ timestamps: true })
export class Asset extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'InventoryItem',
    required: true,
    index: true,
  })
  catalogo_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Property', required: true, index: true })
  propiedad_id: Types.ObjectId;

  @Prop({ type: String, index: true })
  numero_serie: string;

  @Prop({ type: Date })
  fecha_adquisicion: Date;

  @Prop({
    type: String,
    enum: ['NUEVO', 'ACTIVO', 'EN_REPARACION', 'DE_BAJA'],
    required: true,
  })
  estado_actual: string;

  @Prop({ type: [HistorialEstadoSchema] })
  historial_estados: HistorialEstado[];
}

export const AssetSchema = SchemaFactory.createForClass(Asset);
