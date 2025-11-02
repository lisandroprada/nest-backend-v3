import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Bank extends Document {
  @Prop({ type: String, required: true, unique: true, index: true })
  bankId: string; // Internal identifier for the bank (e.g., 'GALICIA', 'SANTANDER')

  @Prop({ type: String, required: true, unique: true, index: true })
  name: string; // Full name of the bank (e.g., 'Banco Galicia S.A.', 'Banco Santander Río S.A.')

  @Prop({ type: String })
  description?: string; // Optional description

  @Prop({ type: String, enum: ['ACTIVO', 'INACTIVO'], default: 'ACTIVO' })
  status: string; // Status of the bank

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_creacion_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_modificacion_id: Types.ObjectId;
}

export const BankSchema = SchemaFactory.createForClass(Bank);
