import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class DocumentTemplate extends Document {
  @Prop({ type: String, required: true, unique: true, index: true })
  name: string;

  @Prop({ type: String, enum: ['Contrato', 'Recibo', 'Comunicado'], required: true })
  type: string;

  @Prop({ type: String, enum: ['oficial', 'simple'], required: true })
  headerType: string;

  @Prop({ type: String, required: true })
  content: string;
}

export const DocumentTemplateSchema = SchemaFactory.createForClass(DocumentTemplate);
