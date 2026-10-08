import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export const QUEST_RARITIES = ['common', 'uncommon', 'rare'] as const;
export type QuestRarity = (typeof QUEST_RARITIES)[number];

export const QUEST_DIFFICULTIES = [
  'easy',
  'moderate',
  'challenging',
] as const;
export type QuestDifficulty = (typeof QUEST_DIFFICULTIES)[number];

@Schema({
  collection: 'questTemplates',
  timestamps: true,
  versionKey: false,
})
export class QuestTemplate {
  @Prop({ type: Number, required: true, min: 1 })
  version!: number;

  @Prop({ type: Boolean, required: true, default: true })
  active!: boolean;

  @Prop({ type: String, required: true, enum: QUEST_RARITIES })
  rarity!: QuestRarity;

  @Prop({ type: String, required: true, enum: QUEST_DIFFICULTIES })
  difficulty!: QuestDifficulty;

  @Prop({ type: String, required: true, trim: true, maxlength: 160 })
  activityShape!: string;

  @Prop({ type: String, required: true, maxlength: 4000 })
  generationGuidance!: string;

  @Prop({ type: [String], required: true })
  completionCriteria!: string[];

  @Prop({ type: String, required: true, maxlength: 1000 })
  proofInstructions!: string;

  @Prop({ type: [String], required: true })
  safetyGuidance!: string[];

  @Prop({ type: [String], required: true, enum: ['Trinidad'], default: ['Trinidad'] })
  allowedRegions!: string[];

  @Prop({ type: Date, required: true, default: Date.now })
  createdAt!: Date;

  @Prop({ type: Date, required: true, default: Date.now })
  updatedAt!: Date;
}

export const QuestTemplateSchema = SchemaFactory.createForClass(QuestTemplate);
