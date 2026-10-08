import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';

@Schema({ _id: false })
export class GuestAuth {
  @Prop({ type: String, required: true, enum: ['guest'] })
  provider!: 'guest';

  @Prop({ type: String, required: true })
  subject!: string;
}

export const GuestAuthSchema = SchemaFactory.createForClass(GuestAuth);

@Schema({ collection: 'users', timestamps: true, versionKey: false })
export class User {
  @Prop({ type: String, trim: true, maxlength: 80 })
  name?: string;

  @Prop({ type: GuestAuthSchema, required: true })
  auth!: GuestAuth;

  @Prop({ type: String, required: true, enum: ['Trinidad'], default: 'Trinidad' })
  region!: 'Trinidad';

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  preferences!: Record<string, unknown>;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  xp!: number;

  @Prop({ type: Date, required: true, default: Date.now })
  createdAt!: Date;

  @Prop({ type: Date, required: true, default: Date.now })
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index(
  { 'auth.provider': 1, 'auth.subject': 1 },
  { unique: true, name: 'users_auth_provider_subject_unique' },
);
