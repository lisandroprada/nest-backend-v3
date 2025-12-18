import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageSource = 'Email' | 'WhatsApp' | 'Formulario Web' | 'Interno';
export type MessageStatus = 'Nuevo' | 'Leído' | 'Archivado';

@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({ required: true })
  subject: string;

  @Prop({
    type: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      avatar: String,
    },
    required: true,
  })
  sender: {
    name: string;
    email: string;
    avatar?: string;
  };

  @Prop({
    type: String,
    enum: ['Email', 'WhatsApp', 'Formulario Web', 'Interno'],
    required: true,
  })
  source: MessageSource;

  @Prop({
    type: String,
    enum: ['Nuevo', 'Leído', 'Archivado'],
    default: 'Nuevo',
  })
  status: MessageStatus;

  @Prop({ required: true })
  content: string;

  @Prop()
  contentPlainText: string;

  @Prop({ type: Date, default: () => new Date() })
  timestamp: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Agent' })
  relatedAgent?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Property' })
  relatedProperty?: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({
    type: [
      {
        nombre: String,
        url: String,
        tipo: String,
        tamaño: Number,
      },
    ],
  })
  attachments?: Array<{
    nombre: string;
    url: string;
    tipo: string;
    tamaño: number;
  }>;

  @Prop({
    type: {
      messageId: String,
      inReplyTo: String,
      references: [String],
    },
  })
  emailMetadata?: {
    messageId?: string;
    inReplyTo?: string;
    references?: string[];
  };

  @Prop()
  originalEmailId?: string;

  // Timestamps automáticos por @Schema({ timestamps: true })
  createdAt: Date;
  updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Índices para mejorar búsquedas
MessageSchema.index({ status: 1, timestamp: -1 });
MessageSchema.index({ assignedTo: 1, status: 1 });
MessageSchema.index({ source: 1, timestamp: -1 });
MessageSchema.index({ 'sender.email': 1 });

// IMPORTANTE: Índice único en messageId para evitar duplicados automáticamente
// sparse: true permite que documentos sin messageId no generen conflicto
MessageSchema.index({ 'emailMetadata.messageId': 1 }, { unique: true, sparse: true });
