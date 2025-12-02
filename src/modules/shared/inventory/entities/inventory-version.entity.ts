import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  InventoryItemSnapshot,
  InventoryItemSnapshotSchema,
} from './inventory-item-snapshot.entity';

@Schema({ timestamps: true })
export class InventoryVersion extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'PropertyInventory',
    required: true,
    index: true,
  })
  property_inventory_id: Types.ObjectId;

  @Prop({ type: Number, required: true })
  version_number: number;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: Date, default: Date.now })
  created_at: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  created_by: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
    default: 'ACTIVE',
  })
  status: string;

  @Prop({ type: [InventoryItemSnapshotSchema], default: [] })
  items: InventoryItemSnapshot[];
}

export const InventoryVersionSchema =
  SchemaFactory.createForClass(InventoryVersion);

// Index compuesto para búsquedas eficientes
InventoryVersionSchema.index({ property_inventory_id: 1, version_number: 1 });
