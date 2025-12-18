import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'accountentries' })
export class LegacyAccountEntry extends Document {
  @Prop({ type: Types.ObjectId })
  accountId: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  masterAccountId: Types.ObjectId;

  @Prop({ type: String })
  accountType: string;

  @Prop({ type: Types.ObjectId })
  agentId: Types.ObjectId;

  @Prop({ type: String })
  description: string;

  @Prop({ type: Date })
  date: Date;

  @Prop({ type: Number })
  amount: number;

  @Prop({ type: String }) // Contract ID usually
  origin: string;

  @Prop({ type: Types.ObjectId })
  receiptId: Types.ObjectId;
}

export const LegacyAccountEntrySchema =
  SchemaFactory.createForClass(LegacyAccountEntry);
