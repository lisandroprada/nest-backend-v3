import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class InventoryItem extends Document {
  @Prop({ type: String, required: true, index: true })
  categoria: string;

  @Prop({ type: String, required: true })
  descripcion_base: string;

  @Prop({ type: String, index: true })
  marca: string;

  @Prop({ type: String })
  modelo: string;
}

export const InventoryItemSchema = SchemaFactory.createForClass(InventoryItem);
