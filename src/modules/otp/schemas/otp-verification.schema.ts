import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * OtpVerification - Schema para códigos OTP de verificación de identidad
 * 
 * Usado para validar la identidad de usuarios que intentan vincular
 * su número de WhatsApp con su cuenta de cliente.
 */
@Schema({ timestamps: true })
export class OtpVerification extends Document {
  @Prop({ required: true, index: true })
  whatsappJid: string; // JID de WhatsApp del usuario

  @Prop({ required: true, index: true })
  dni: string; // DNI/CUIT del cliente

  @Prop({ required: true })
  otp: string; // Código OTP (6 dígitos)

  @Prop({ required: true })
  expiresAt: Date; // Fecha de expiración (15 minutos desde creación)

  @Prop({ default: false })
  verified: boolean; // Si el OTP ya fue verificado

  @Prop()
  verifiedAt?: Date; // Fecha de verificación

  @Prop({ required: true })
  clientId: string; // ID del cliente en el sistema (para vincular después)

  @Prop()
  clientName: string; // Nombre del cliente (para logs)

  @Prop({ default: 0 })
  attempts: number; // Intentos de verificación (máximo 3)
}

export const OtpVerificationSchema = SchemaFactory.createForClass(OtpVerification);

// Índice TTL para auto-eliminar documentos expirados
OtpVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Índice compuesto para búsquedas rápidas
OtpVerificationSchema.index({ whatsappJid: 1, verified: 1 });
