import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum TicketCategory {
  PLUMBING = 'plumbing',
  ELECTRIC = 'electric',
  HEATING = 'heating',
  CLEANING = 'cleaning',
  SECURITY = 'security',
  OTHER = 'other',
}

export enum TicketUrgency {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum TicketSource {
  WHATSAPP = 'whatsapp',
  WEB = 'web',
  EMAIL = 'email',
  PHONE = 'phone',
}

/**
 * Ticket - Schema para reclamos/tickets de clientes
 * 
 * Usado para gestionar reclamos reportados por clientes
 * a través de WhatsApp, web, email o teléfono.
 */
@Schema({ timestamps: true })
export class Ticket extends Document {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Agent', index: true })
  clientId: Types.ObjectId; // ID del cliente que reporta

  @Prop({ required: true })
  clientName: string; // Nombre del cliente (desnormalizado para queries rápidas)

  @Prop({ type: Types.ObjectId, ref: 'Property' })
  propertyId?: Types.ObjectId; // ID de la propiedad (opcional)

  @Prop()
  propertyAddress?: string; // Dirección de la propiedad (desnormalizado)

  @Prop({ required: true, enum: TicketCategory })
  category: TicketCategory; // Categoría del reclamo

  @Prop({ required: true })
  description: string; // Descripción detallada del problema

  @Prop({ required: true, enum: TicketUrgency, default: TicketUrgency.MEDIUM })
  urgency: TicketUrgency; // Nivel de urgencia

  @Prop({ required: true, enum: TicketStatus, default: TicketStatus.OPEN })
  status: TicketStatus; // Estado del ticket

  @Prop({ required: true, enum: TicketSource })
  source: TicketSource; // Canal por el que se reportó

  @Prop()
  whatsappJid?: string; // JID de WhatsApp (si vino por WhatsApp)

  @Prop({ type: [String], default: [] })
  evidenceUrls: string[]; // URLs de fotos/videos de evidencia

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId; // Usuario asignado (opcional)

  @Prop()
  resolution?: string; // Descripción de la resolución (cuando se cierra)

  @Prop()
  resolvedAt?: Date; // Fecha de resolución

  @Prop()
  closedAt?: Date; // Fecha de cierre

  @Prop({ type: [{ text: String, author: String, createdAt: Date }], default: [] })
  notes: Array<{ text: string; author: string; createdAt: Date }>; // Notas internas

  // Timestamps (auto-generados por Mongoose con timestamps: true)
  createdAt: Date;
  updatedAt: Date;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);

// Índices para búsquedas eficientes
TicketSchema.index({ clientId: 1, status: 1 });
TicketSchema.index({ status: 1, urgency: 1 });
TicketSchema.index({ createdAt: -1 });
