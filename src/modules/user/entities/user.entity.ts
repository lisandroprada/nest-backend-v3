import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class User extends Document {
  @Prop({ index: true, required: true })
  username: string;
  @Prop({ unique: true, required: true })
  email: string;
  @Prop({ minlength: 6, required: true })
  password: string;
  @Prop({ default: ['user'] })
  roles: string[];
  @Prop()
  photo: string;
  @Prop()
  pinCode: string;
  @Prop({ default: () => new Date() })
  createdAt: Date;
  @Prop()
  resetPasswordToken?: string;
  @Prop()
  resetPasswordExpires?: Date;
  @Prop({ default: true })
  isActive: boolean;
  @Prop({})
  avatar: string;
  @Prop({ type: Types.ObjectId, ref: 'Party' })
  party: Types.ObjectId;

  // Email corporativo y configuración de sincronización
  @Prop()
  emailCorporativo?: string;
  @Prop({
    type: {
      provider: { type: String, enum: ['GMAIL', 'OUTLOOK', 'IMAP'] },
      accessToken: String,
      refreshToken: String,
      imapConfig: {
        type: {
          host: String,
          port: Number,
          user: String,
          password: String, // Debe encriptarse antes de guardar
          tls: { type: Boolean, default: true },
        },
      },
      sincronizacionActiva: { type: Boolean, default: false },
      ultimaSincronizacion: Date,
    },
  })
  emailCorporativoConfig?: {
    provider: 'GMAIL' | 'OUTLOOK' | 'IMAP';
    accessToken?: string;
    refreshToken?: string;
    imapConfig?: {
      host: string;
      port: number;
      user: string;
      password: string;
      tls?: boolean;
    };
    sincronizacionActiva: boolean;
    ultimaSincronizacion?: Date;
  };

  // Tracking de sincronización IMAP (como clientes de correo reales)
  @Prop({
    type: {
      lastSyncedUID: Number,
      lastSyncDate: Date,
    },
  })
  emailSync?: {
    lastSyncedUID?: number;
    lastSyncDate?: Date;
  };
}

export const UserSchema = SchemaFactory.createForClass(User);
