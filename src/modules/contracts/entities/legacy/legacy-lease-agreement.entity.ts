import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'leaseagreements', strict: false })
export class LegacyLeaseAgreement extends Document {
  @Prop({ type: Object })
  property: {
    _id: Types.ObjectId;
  };

  @Prop({ type: Date })
  startDate: Date;

  @Prop({ type: Date })
  createdAt: Date;
}

export const LegacyLeaseAgreementSchema = SchemaFactory.createForClass(LegacyLeaseAgreement);
