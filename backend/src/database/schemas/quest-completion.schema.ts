import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import type { Types } from 'mongoose';

@Schema({ collection: 'questCompletions', versionKey: false })
export class QuestCompletion {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: 'Quest' })
  questId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: 'QuestAcceptance' })
  acceptanceId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: 'SubmissionAttempt' })
  winningAttemptId!: Types.ObjectId;

  @Prop({ type: Date, required: true, default: Date.now })
  completedAt!: Date;
}

export const QuestCompletionSchema =
  SchemaFactory.createForClass(QuestCompletion);
QuestCompletionSchema.index(
  { acceptanceId: 1 },
  { unique: true, name: 'quest_completion_acceptance_unique' },
);
QuestCompletionSchema.index(
  { userId: 1, questId: 1, completedAt: -1 },
  { name: 'quest_completions_user_quest_date' },
);
