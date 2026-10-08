import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import type { Types } from 'mongoose';

@Schema({ collection: 'xpAwards', versionKey: false })
export class XpAward {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: 'QuestCompletion' })
  completionId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: 'Quest' })
  questId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, enum: [25, 50, 100] })
  amount!: number;

  @Prop({ type: Date, required: true, default: Date.now })
  awardedAt!: Date;
}

export const XpAwardSchema = SchemaFactory.createForClass(XpAward);
XpAwardSchema.index(
  { completionId: 1 },
  { unique: true, name: 'xp_awards_completion_unique' },
);
XpAwardSchema.index(
  { userId: 1, questId: 1 },
  { unique: true, name: 'xp_awards_user_quest_unique' },
);
XpAwardSchema.index(
  { userId: 1, awardedAt: -1 },
  { name: 'xp_awards_user_date' },
);
