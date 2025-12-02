import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class PropertyInventory extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'Property',
    required: true,
    unique: true,
    index: true,
  })
  property_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'InventoryVersion' })
  current_version_id: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'InventoryVersion' }] })
  versions: Types.ObjectId[];
}

export const PropertyInventorySchema =
  SchemaFactory.createForClass(PropertyInventory);
