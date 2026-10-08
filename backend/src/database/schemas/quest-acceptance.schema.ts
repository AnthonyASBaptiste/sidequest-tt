import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import type { Types } from 'mongoose';

@Schema({ _id: false })
export class AcceptedQuestSnapshot {
  @Prop({ type: String, required: true })
  title!: string;

  @Prop({ type: String, required: true })
  description!: string;

  @Prop({ type: String, required: true })
  region!: string;

  @Prop({ type: Number, required: true })
  durationMinutes!: number;

  @Prop({ type: String, required: true })
  difficulty!: string;

  @Prop({ type: String, required: true })
  rarity!: string;

  @Prop({ type: Number, required: true })
  xp!: number;

  @Prop({ type: String, required: true })
  proofInstructions!: string;

  @Prop({ type: [String], required: true })
  completionCriteria!: string[];

  @Prop({ type: [String], required: true })
  safetyGuidance!: string[];
}

export const AcceptedQuestSnapshotSchema =
  SchemaFactory.createForClass(AcceptedQuestSnapshot);

@Schema({ collection: 'questAcceptances', versionKey: false })
export class QuestAcceptance {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: 'Quest' })
  questId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1 })
  acceptanceNumber!: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, default: undefined, ref: 'User' })
  activeUserId?: Types.ObjectId;

  @Prop({ type: AcceptedQuestSnapshotSchema, required: true })
  questSnapshot!: AcceptedQuestSnapshot;

  @Prop({
    type: String,
    required: true,
    enum: ['accepted', 'submitted', 'retry', 'completed', 'expired'],
  })
  status!: 'accepted' | 'submitted' | 'retry' | 'completed' | 'expired';

  @Prop({ type: Date, required: true, default: Date.now })
  acceptedAt!: Date;

  @Prop({ type: Date, required: true, default: Date.now })
  updatedAt!: Date;
}

export const QuestAcceptanceSchema =
  SchemaFactory.createForClass(QuestAcceptance);
QuestAcceptanceSchema.index(
  { userId: 1, questId: 1, acceptanceNumber: 1 },
  { unique: true, name: 'quest_acceptance_number_unique' },
);
QuestAcceptanceSchema.index(
  { activeUserId: 1 },
  { unique: true, sparse: true, name: 'one_active_quest_per_user' },
);
QuestAcceptanceSchema.index(
  { userId: 1, status: 1, acceptedAt: -1 },
  { name: 'quest_acceptances_user_status_date' },
);
