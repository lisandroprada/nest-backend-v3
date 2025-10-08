import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Sequence extends Document {
  @Prop({ required: true, unique: true })
  name: string; // El nombre de la secuencia, por ejemplo 'receipt', 'invoice', etc.

  @Prop({ required: true })
  value: number; // El valor actual de la secuencia

  @Prop({ required: false })
  date: string; // (Opcional) Fecha para secuencias basadas en fecha, si lo necesitas
}

export const SequenceSchema = SchemaFactory.createForClass(Sequence);
