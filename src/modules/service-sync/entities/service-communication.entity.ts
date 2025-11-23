import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum CommunicationType {
  FACTURA_DISPONIBLE = 'FACTURA_DISPONIBLE',
  VENCIMIENTO_PROXIMO = 'VENCIMIENTO_PROXIMO',
  AVISO_DEUDA = 'AVISO_DEUDA',
  AVISO_CORTE = 'AVISO_CORTE',
  OTRO = 'OTRO',
}

export enum CommunicationStatus {
  UNPROCESSED = 'UNPROCESSED',
  PROCESSED = 'PROCESSED',
  IGNORED = 'IGNORED',
  ERROR = 'ERROR',
}

@Schema({ timestamps: true, collection: 'service_communications' })
export class ServiceCommunication extends Document {
  @Prop({ required: true, unique: true, index: true })
  email_id: string;

  @Prop({ required: false, index: true })
  proveedor_cuit?: string;

  @Prop({ type: Types.ObjectId, ref: 'Agent', index: true })
  proveedor_id?: Types.ObjectId;

  @Prop({ required: false })
  remitente?: string;

  @Prop({ required: false, index: true })
  asunto?: string;

  @Prop({ required: false, index: true })
  fecha_email?: Date;

  @Prop({ required: false })
  cuerpo_texto?: string;

  @Prop({ required: false })
  cuerpo_html?: string;

  @Prop({
    type: String,
    enum: CommunicationType,
    default: CommunicationType.OTRO,
    index: true,
  })
  tipo_alerta: CommunicationType;

  @Prop({ required: false, index: true })
  identificador_servicio?: string; // número de cuenta/cliente/medidor

  @Prop({ required: false })
  numero_medidor?: string;

  @Prop({ required: false })
  monto_estimado?: number;

  @Prop({ required: false, index: true })
  fecha_vencimiento?: Date;

  @Prop({ required: false })
  periodo_label?: string; // ej. 10/2025

  @Prop({ type: [Types.ObjectId], ref: 'Property' })
  propiedades_sugeridas_ids?: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Property' })
  propiedad_confirmada_id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'DetectedExpense' })
  gasto_detectado_id?: Types.ObjectId;

  @Prop({
    type: String,
    enum: CommunicationStatus,
    default: CommunicationStatus.UNPROCESSED,
    index: true,
  })
  estado_procesamiento: CommunicationStatus;

  @Prop({ required: false })
  notas?: string;

  @Prop({ required: false })
  error_message?: string;
}

export const ServiceCommunicationSchema =
  SchemaFactory.createForClass(ServiceCommunication);

// Índices compuestos y optimización de consultas
ServiceCommunicationSchema.index({
  identificador_servicio: 1,
  fecha_email: -1,
});
ServiceCommunicationSchema.index({ tipo_alerta: 1, estado_procesamiento: 1 });
ServiceCommunicationSchema.index({ proveedor_cuit: 1, fecha_email: -1 });
ServiceCommunicationSchema.index({
  estado_procesamiento: 1,
  fecha_vencimiento: 1,
});
