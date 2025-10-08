import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class RealEstate extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  type: string; // 'inmobiliaria' para identificar el tipo de entidad

  @Prop({ required: true })
  address: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  email: string;
}

export const RealEstateSchema = SchemaFactory.createForClass(RealEstate);
