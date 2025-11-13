import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum CandidateStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
}

@Schema({ timestamps: true, collection: 'candidatos_conciliacion' })
export class ConciliationCandidate extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'BankMovement',
    required: true,
    index: true,
  })
  bank_movement_id: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Transaction',
    required: true,
    index: true,
  })
  transaction_id: Types.ObjectId;

  @Prop({
    required: true,
    default: CandidateStatus.PENDING,
    enum: CandidateStatus,
    index: true,
  })
  status: CandidateStatus;

  @Prop({ required: true })
  score: number; // 0..100

  @Prop({ required: false })
  match_reasons: string[]; // razones del match (monto, fecha, cuit)

  @Prop({ required: false })
  notes: string;
}

export const ConciliationCandidateSchema = SchemaFactory.createForClass(
  ConciliationCandidate,
);

ConciliationCandidateSchema.index(
  { bank_movement_id: 1, transaction_id: 1 },
  { unique: true },
);
