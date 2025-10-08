import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
class DatosRegistroPropiedad {
  @Prop({ type: String })
  folio: string;

  @Prop({ type: String })
  tomo: string;

  @Prop({ type: Date })
  fecha_registro: Date;
}
const DatosRegistroPropiedadSchema = SchemaFactory.createForClass(
  DatosRegistroPropiedad,
);

@Schema({ _id: false })
class Direccion {
  @Prop({ type: String })
  calle: string;

  @Prop({ type: String })
  numero: string;

  @Prop({ type: String })
  piso_dpto: string;

  @Prop({ type: Types.ObjectId, ref: 'Province', required: true })
  provincia_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Locality', required: true })
  localidad_id: Types.ObjectId;

  @Prop({ type: String })
  codigo_postal: string;

  @Prop({ type: Number })
  latitud: number;

  @Prop({ type: Number })
  longitud: number;
}
const DireccionSchema = SchemaFactory.createForClass(Direccion);

@Schema({ _id: false })
class ServicioImpuesto {
  @Prop({ type: Types.ObjectId, ref: 'Agent', required: true })
  proveedor_id: Types.ObjectId;

  @Prop({ type: String, required: true })
  identificador_servicio: string;

  @Prop({ type: Number, required: true })
  porcentaje_aplicacion: number;
}
const ServicioImpuestoSchema = SchemaFactory.createForClass(ServicioImpuesto);

@Schema({ _id: false })
class Caracteristicas {
  @Prop({ type: Number })
  dormitorios: number;

  @Prop({ type: Number })
  banos: number;

  @Prop({ type: Number })
  ambientes: number;

  @Prop({ type: Number })
  metraje_total: number;

  @Prop({ type: Number })
  metraje_cubierto: number;

  @Prop({ type: Number })
  antiguedad_anos: number;

  @Prop({ type: Number })
  cochera: number;

  @Prop({
    type: String,
    enum: ['A ESTRENAR', 'EXCELENTE', 'BUENO', 'A RECICLAR'],
  })
  estado_general: string;

  @Prop({ type: String, enum: ['NORTE', 'SUR', 'ESTE', 'OESTE'] })
  orientacion: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Amenity' }], index: true })
  amenities: Types.ObjectId[];
}
const CaracteristicasSchema = SchemaFactory.createForClass(Caracteristicas);

@Schema({ timestamps: true })
export class Property extends Document {
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Agent' }], required: true })
  propietarios_ids: Types.ObjectId[];

  @Prop({ type: String, unique: true, required: true, index: true })
  identificador_interno: string;

  @Prop({ type: String, index: true })
  identificador_tributario: string;

  @Prop({ type: DatosRegistroPropiedadSchema })
  datos_registro_propiedad: DatosRegistroPropiedad;

  @Prop({ type: DireccionSchema })
  direccion: Direccion;

  @Prop({ type: CaracteristicasSchema })
  caracteristicas: Caracteristicas;

  @Prop({ type: [ServicioImpuestoSchema] })
  servicios_impuestos: ServicioImpuesto[];

  @Prop({ type: String })
  consorcio_nombre: string;

  @Prop({ type: String, enum: ['ORDINARIAS', 'EXTRAORDINARIAS', 'INCLUIDAS'] })
  tipo_expensas: string;

  @Prop({ type: String })
  img_cover_url: string;

  @Prop({ type: Number })
  valor_venta: number;

  @Prop({ type: Number })
  valor_alquiler: number;

  @Prop({
    type: String,
    enum: ['COMERCIAL', 'VIVIENDA', 'INDUSTRIAL', 'MIXTO'],
  })
  proposito: string;

  @Prop({
    type: String,
    enum: [
      'OCUPADA',
      'EN_REFACCION',
      'DISPONIBLE',
      'ALQUILADA',
      'VENDIDA',
      'RESERVADA',
    ],
    default: 'DISPONIBLE',
  })
  estado_ocupacional: string;

  @Prop({ type: Types.ObjectId, ref: 'Contract' })
  contrato_vigente_id: Types.ObjectId;

  @Prop({ type: [Object] })
  documentos_digitales: { nombre: string; url: string }[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_creacion_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_modificacion_id: Types.ObjectId;
}

export const PropertySchema = SchemaFactory.createForClass(Property);
