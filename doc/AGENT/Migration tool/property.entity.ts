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
export class ServicioImpuesto {
  @Prop({ type: Types.ObjectId, ref: 'Agent', required: true })
  proveedor_id: Types.ObjectId;

  @Prop({ type: String, required: true })
  identificador_servicio: string;

  @Prop({ type: Number, required: true })
  porcentaje_aplicacion: number;

  @Prop({ type: String, enum: ['LOCADOR', 'LOCATARIO'] })
  origen: string; // Quien debe pagar el servicio/impuesto

  @Prop({ type: String, enum: ['PRESTADOR', 'LOCADOR'] })
  destino: string; // A quien se le paga (empresa prestadora o se rinde al locador)
}
export const ServicioImpuestoSchema =
  SchemaFactory.createForClass(ServicioImpuesto);

@Schema({ _id: false })
class Caracteristicas {
  @Prop({
    type: String,
    enum: [
      'departamento',
      'casa',
      'ph',
      'oficina',
      'local_comercial',
      'galpon',
      'lote',
      'quinta',
      'chacra',
      'estudio',
      'loft',
      'duplex',
      'triplex',
    ],
  })
  tipo_propiedad: string;

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
    enum: [
      'EXCELENTE',
      'MUY_BUENO',
      'BUENO',
      'REGULAR',
      'MALO',
      'A_REFACCIONAR',
    ],
  })
  estado_general: string;

  @Prop({
    type: String,
    enum: [
      'NORTE',
      'SUR',
      'ESTE',
      'OESTE',
      'NORESTE',
      'NOROESTE',
      'SURESTE',
      'SUROESTE',
    ],
  })
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

  @Prop({ type: String })
  titulo: string;

  @Prop({ type: String })
  descripcion: string;

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

  // Nuevos campos de precios avanzados
  @Prop({ type: Object })
  valor_venta_detallado: {
    monto: number;
    moneda: string; // 'USD', 'ARS'
    es_publico: boolean;
    descripcion: string;
  };

  @Prop({ type: Object })
  valor_alquiler_detallado: {
    monto: number;
    moneda: string;
    es_publico: boolean;
    descripcion: string;
  };

  // Flags de publicación
  @Prop({ type: Boolean, default: false })
  publicar_para_venta: boolean;

  @Prop({ type: Boolean, default: false })
  publicar_para_alquiler: boolean;

  @Prop({
    type: String,
    enum: ['COMERCIAL', 'VIVIENDA', 'INDUSTRIAL', 'MIXTO'],
  })
  proposito: string;

  @Prop({
    type: String,
    enum: ['DISPONIBLE', 'ALQUILADO', 'RESERVADO', 'INACTIVO'],
    default: 'DISPONIBLE',
    index: true,
  })
  status: string;

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

  // Campos para gestión de multimedia
  @Prop({ type: Array })
  imagenes: {
    nombre: string;
    url: string;
    orden: number;
    es_portada: boolean;
    versiones: { thumb: string; slider: string; original: string };
  }[];

  @Prop({ type: Array })
  planos: { nombre: string; url: string; descripcion: string }[];

  // Campos para lotes y mapa satelital
  @Prop({ type: Object })
  imagen_satelital: {
    nombre: string;
    url: string;
    ancho: number;
    alto: number;
    pixels_por_metro: number;
  };

  @Prop({ type: Array })
  lotes: {
    id: string;
    coordenadas: { x: number; y: number }[];
    status: string;
    precio: number;
    moneda: string;
    superficie_m2: number;
  }[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_creacion_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_modificacion_id: Types.ObjectId;
}

export const PropertySchema = SchemaFactory.createForClass(Property);

// Virtual para obtener el título, con fallback a la dirección
PropertySchema.virtual('titulo_display').get(function () {
  if (this.titulo) {
    return this.titulo;
  }

  // Construir título desde la dirección
  if (this.direccion) {
    const partes = [];
    if (this.direccion.calle) partes.push(this.direccion.calle);
    if (this.direccion.numero) partes.push(this.direccion.numero);
    if (this.direccion.piso_dpto) partes.push(this.direccion.piso_dpto);

    return partes.length > 0 ? partes.join(' ') : 'Propiedad sin título';
  }

  return 'Propiedad sin título';
});

// Asegurar que los virtuals se serialicen en JSON
PropertySchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.__v;
    return ret;
  },
});

PropertySchema.set('toObject', { virtuals: true });
