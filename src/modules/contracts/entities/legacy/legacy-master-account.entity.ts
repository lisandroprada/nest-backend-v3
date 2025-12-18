import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'masteraccounts' })
export class LegacyMasterAccount extends Document {
  @Prop({ type: String })
  type: string;

  @Prop({ type: String })
  description: string;

  @Prop({ type: Date })
  date: Date;

  @Prop({ type: Object })
  source: {
    _id: Types.ObjectId;
    fullName: string;
  };

  @Prop({ type: Object })
  target: {
    _id: Types.ObjectId;
    fullName: string;
  };
}

export const LegacyMasterAccountSchema =
  SchemaFactory.createForClass(LegacyMasterAccount);
