import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum EstadoGeneral {
  EXCELENTE = 'EXCELENTE',
  MUY_BUENO = 'MUY_BUENO',
  BUENO = 'BUENO',
  REGULAR = 'REGULAR',
  MALO = 'MALO',
}

@Schema({ timestamps: true })
export class Comparable extends Document {
  @Prop({ required: true })
  titulo: string;

  @Prop({ type: Types.ObjectId, ref: 'Locality', required: true })
  localidad_id: Types.ObjectId;

  @Prop({ required: true })
  superficie_m2: number;

  @Prop({ required: true })
  antiguedad_anos: number;

  @Prop({ required: true, enum: EstadoGeneral })
  estado_general: EstadoGeneral;

  @Prop({ required: true })
  valor_transaccion: number;

  @Prop({ required: true })
  moneda: string;

  @Prop({ required: true })
  fecha_transaccion: Date;
}

export const ComparableSchema = SchemaFactory.createForClass(Comparable);
