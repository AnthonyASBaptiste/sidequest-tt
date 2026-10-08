import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import type { Types } from 'mongoose';
import { QUEST_DIFFICULTIES, QUEST_RARITIES } from './quest-template.schema.js';

const RARITY_XP: Record<string, number> = {
  common: 25,
  uncommon: 50,
  rare: 100,
};

const RARITY_DURATION: Record<string, { min: number; max: number }> = {
  common: { min: 10, max: 30 },
  uncommon: { min: 30, max: 60 },
  rare: { min: 60, max: 120 },
};

@Schema({ collection: 'quests', versionKey: false })
export class Quest {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: 'QuestPoolBatch' })
  batchId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  slot!: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: 'QuestTemplate' })
  templateId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1 })
  templateVersion!: number;

  @Prop({ type: String, required: true, trim: true, maxlength: 120 })
  title!: string;

  @Prop({ type: String, required: true, maxlength: 2000 })
  description!: string;

  @Prop({ type: String, required: true, enum: ['Trinidad'], default: 'Trinidad' })
  region!: 'Trinidad';

  @Prop({ type: String, default: null, maxlength: 240 })
  localContext!: string | null;

  @Prop({
    type: Number,
    required: true,
    min: 10,
    max: 120,
    validate: {
      validator(this: Quest, value: number): boolean {
        const band = RARITY_DURATION[this.rarity];
        return band !== undefined && value >= band.min && value <= band.max;
      },
      message: 'durationMinutes must fall within the quest rarity duration band.',
    },
  })
  durationMinutes!: number;

  @Prop({ type: String, required: true, enum: QUEST_DIFFICULTIES })
  difficulty!: string;

  @Prop({
    type: String,
    required: true,
    enum: QUEST_RARITIES,
    validate: {
      validator(this: Quest, value: string): boolean {
        return RARITY_XP[value] !== undefined && this.xp === RARITY_XP[value];
      },
      message: 'Quest XP must match its rarity award.',
    },
  })
  rarity!: string;

  @Prop({ type: Number, required: true, enum: [25, 50, 100] })
  xp!: number;

  @Prop({ type: String, required: true, enum: ['text'], default: 'text' })
  proofType!: 'text';

  @Prop({ type: String, required: true, maxlength: 1000 })
  proofInstructions!: string;

  @Prop({ type: [String], required: true })
  completionCriteria!: string[];

  @Prop({ type: [String], required: true })
  safetyGuidance!: string[];

  @Prop({ type: String, required: true, enum: ['gemma'], default: 'gemma' })
  generatedBy!: 'gemma';

  @Prop({ type: String, required: true })
  model!: string;

  @Prop({ type: String, required: true })
  promptVersion!: string;

  @Prop({ type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ })
  availableOn!: string;

  @Prop({ type: Date, default: null })
  expiresAt!: Date | null;

  @Prop({
    type: String,
    required: true,
    enum: ['available', 'expired', 'disabled'],
    default: 'available',
  })
  status!: 'available' | 'expired' | 'disabled';

  @Prop({ type: Date, required: true, default: Date.now })
  createdAt!: Date;
}

export const QuestSchema = SchemaFactory.createForClass(Quest);
QuestSchema.index(
  { batchId: 1, slot: 1 },
  { unique: true, name: 'quests_batch_slot_unique' },
);
QuestSchema.index(
  { region: 1, status: 1, availableOn: 1 },
  { name: 'quests_region_status_available_on' },
);
