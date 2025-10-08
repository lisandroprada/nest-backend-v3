import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Province extends Document {
  @Prop({ required: true })
  id: number;

  @Prop({ required: true })
  nombre: string;

  @Prop()
  nombre_completo: string;

  @Prop()
  fuente: string;

  @Prop()
  categoria: string;

  @Prop({ type: { lon: Number, lat: Number } })
  centroide: {
    lon: number;
    lat: number;
  };

  @Prop()
  iso_id: string;

  @Prop()
  iso_nombre: string;
}

export const ProvinceSchema = SchemaFactory.createForClass(Province);
