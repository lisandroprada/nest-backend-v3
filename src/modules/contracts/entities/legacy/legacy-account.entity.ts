import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, SchemaTypes } from 'mongoose';

@Schema({ collection: 'accounts' })
export class LegacyAccount extends Document {
  @Prop({ type: Types.ObjectId })
  masterAccount: Types.ObjectId;

  @Prop({ type: String })
  account: string; // Account Code

  @Prop({ type: String })
  accountType: string;

  @Prop({ type: String })
  accountDescription: string;

  @Prop({ type: SchemaTypes.Mixed }) // Contract ID usually (String or ObjectId)
  origin: string | Types.ObjectId;

  @Prop({ type: Number })
  amount: number;
  
  @Prop({ type: Number })
  totalBalance: number;
}

export const LegacyAccountSchema = SchemaFactory.createForClass(LegacyAccount);
