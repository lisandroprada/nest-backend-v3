import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class InventoryItemSnapshot {
  @Prop({ type: String, required: true })
  nombre: string;

  @Prop({
    type: String,
    enum: ['Nuevo', 'Bueno', 'Regular', 'Malo'],
    required: true,
  })
  estado: string;

  @Prop({ type: Number, default: 1 })
  cantidad: number;

  @Prop({ type: String })
  categoria: string;

  @Prop({ type: String })
  marca: string;

  @Prop({ type: String })
  modelo: string;

  @Prop({ type: String })
  descripcion: string;

  @Prop({ type: [String], default: [] })
  fotos_urls: string[];
}

export const InventoryItemSnapshotSchema = SchemaFactory.createForClass(
  InventoryItemSnapshot,
);
