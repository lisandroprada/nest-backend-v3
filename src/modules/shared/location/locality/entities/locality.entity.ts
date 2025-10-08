import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

interface Provincia {
  _id: Types.ObjectId;
  id: number;
  nombre: string;
}

interface Departamento {
  id: string;
  nombre: string;
}

interface Municipio {
  id: number;
  nombre: string;
}

interface LocalidadCensal {
  id: string;
  nombre: string;
}

interface Centroide {
  lon: number;
  lat: number;
}

@Schema()
export class Locality extends Document {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  nombre: string;

  @Prop()
  fuente: string;

  @Prop({ type: Object })
  provincia: Provincia;

  @Prop({ type: Object })
  departamento: Departamento;

  @Prop({ type: Object })
  municipio: Municipio;

  @Prop({ type: Object })
  localidad_censal: LocalidadCensal;

  @Prop()
  categoria: string;

  @Prop({ type: Object })
  centroide: Centroide;
}

export const LocalitySchema = SchemaFactory.createForClass(Locality);

LocalitySchema.index({ 'municipio.id': 1 });
// LocalitySchema.index({ 'provincia._id': 1 });
