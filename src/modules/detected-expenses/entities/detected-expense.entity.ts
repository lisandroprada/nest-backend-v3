import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class DetectedExpense extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Agent', required: true, index: true })
  agente_proveedor_id: Types.ObjectId;

  @Prop({ type: String, index: true, required: false })
  provider_cuit?: string;

  @Prop({ type: Date, default: Date.now, index: true })
  fecha_deteccion: Date;

  @Prop({
    type: String,
    enum: ['FACTURA_DISPONIBLE', 'AVISO_DEUDA', 'AVISO_CORTE'],
    required: true,
  })
  tipo_alerta: string;

  @Prop({ type: String, required: true, index: true })
  identificador_servicio: string;

  @Prop({ type: Number })
  monto_estimado: number;

  @Prop({
    type: String,
    enum: ['PENDIENTE_VALIDACION', 'ASIGNADO', 'DESCARTADO'],
    default: 'PENDIENTE_VALIDACION',
    index: true,
  })
  estado_procesamiento: string;

  @Prop({ type: String })
  cuerpo_email: string;

  @Prop({ type: String })
  adjunto_referencia_url: string;

  @Prop({ type: Object })
  propuesta_asiento?: any; // Guarda la propuesta generada por processDetectedUtilityInvoices

  @Prop({ type: Types.ObjectId, ref: 'AccountingEntry' })
  asiento_creado_id?: Types.ObjectId;

  @Prop({ type: String })
  estado_final?: string;
}

export const DetectedExpenseSchema =
  SchemaFactory.createForClass(DetectedExpense);
