import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { QUEST_REGIONS, type QuestRegion } from './quest-template.schema.js';

@Schema({
  collection: 'questPoolBatches',
  versionKey: false,
})
export class QuestPoolBatch {
  @Prop({ type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ })
  poolDate!: string;

  @Prop({ type: String, required: true, enum: QUEST_REGIONS, default: 'Trinidad' })
  region!: QuestRegion;

  @Prop({
    type: String,
    required: true,
    enum: ['generating', 'published', 'failed'],
  })
  status!: 'generating' | 'published' | 'failed';

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  questCount!: number;

  @Prop({ type: String, required: true })
  model!: string;

  @Prop({ type: String, required: true })
  promptVersion!: string;

  @Prop({ type: Date, required: true, default: Date.now })
  startedAt!: Date;

  @Prop({ type: Date, default: null })
  publishedAt!: Date | null;

  @Prop({ type: String, default: null })
  errorCode!: string | null;
}

export const QuestPoolBatchSchema =
  SchemaFactory.createForClass(QuestPoolBatch);
QuestPoolBatchSchema.index(
  { region: 1, poolDate: 1 },
  { unique: true, name: 'quest_pool_region_date_unique' },
);
