import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class IndexValue extends Document {
  @Prop({ required: true })
  formula: string; // Nombre del índice, como "CASAPROPIA", "ICL", etc.

  @Prop({ required: true })
  value: number; // Valor del índice

  @Prop({ required: true })
  date: Date; // Fecha en que se obtuvo el valor del índice

  @Prop({ required: true })
  year: number; // Año del valor del índice

  @Prop({ required: true })
  month: string; // Mes del valor del índice

  @Prop({ required: true })
  day: number; // Día del valor del índice
}

export const IndexValueSchema = SchemaFactory.createForClass(IndexValue);
