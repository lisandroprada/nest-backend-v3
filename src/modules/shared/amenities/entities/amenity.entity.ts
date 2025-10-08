import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Amenity extends Document {
  @Prop({ type: String, required: true, unique: true, index: true })
  nombre: string;

  @Prop({ type: String, required: true, index: true })
  categoria: string;
}

export const AmenitySchema = SchemaFactory.createForClass(Amenity);
