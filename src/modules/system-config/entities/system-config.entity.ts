import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'configuracion_servicios' })
export class SystemConfig extends Document {
  @Prop({ required: true, unique: true })
  email_consulta: string;

  @Prop({ required: true })
  password_consulta: string; // Almacenado encriptado

  @Prop({ required: true })
  host_imap: string;

  @Prop({ required: true })
  port_imap: number;

  @Prop({ required: false, default: true })
  secure: boolean; // SSL/TLS

  @Prop({ required: true, default: 15 })
  check_period_days: number; // Días a escanear hacia atrás

  @Prop({ type: Date })
  fecha_ultima_consulta: Date; // Timestamp del último escaneo exitoso

  @Prop({ default: true })
  activo: boolean; // Para habilitar/deshabilitar el escaneo automático
}

export const SystemConfigSchema = SchemaFactory.createForClass(SystemConfig);

// Aseguramos que solo exista un documento de configuración
SystemConfigSchema.index({ email_consulta: 1 }, { unique: true });
