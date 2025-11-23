import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'service_account_mappings' })
export class ServiceAccountMapping extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Agent', required: true, index: true })
  provider_agent_id: Types.ObjectId;

  @Prop({ type: String })
  provider_cuit?: string;

  @Prop({ type: String })
  identificador_servicio?: string;

  @Prop({ type: String, required: true })
  cuenta_por_cobrar_codigo: string; // e.g., 'CXC_SERVICIOS'

  @Prop({ type: String, required: true })
  cuenta_por_pagar_codigo: string; // e.g., 'CXP_SERVICIOS'

  @Prop({ type: String })
  moneda?: string;

  @Prop({ type: Boolean, default: true })
  enabled: boolean;

  @Prop({ type: Number, default: 0 })
  prioridad: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  created_by?: Types.ObjectId;
}

export const ServiceAccountMappingSchema = SchemaFactory.createForClass(
  ServiceAccountMapping,
);
