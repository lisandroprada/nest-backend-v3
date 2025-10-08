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
}

export const UserSchema = SchemaFactory.createForClass(User);
