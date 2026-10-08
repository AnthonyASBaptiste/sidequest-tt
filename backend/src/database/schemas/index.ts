import type { ModelDefinition } from '@nestjs/mongoose';
import {
  QuestAcceptance,
  QuestAcceptanceSchema,
} from './quest-acceptance.schema.js';
import {
  QuestCompletion,
  QuestCompletionSchema,
} from './quest-completion.schema.js';
import {
  QuestPoolBatch,
  QuestPoolBatchSchema,
} from './quest-pool-batch.schema.js';
import { Quest, QuestSchema } from './quest.schema.js';
import {
  QuestTemplate,
  QuestTemplateSchema,
} from './quest-template.schema.js';
import {
  SubmissionAttempt,
  SubmissionAttemptSchema,
} from './submission-attempt.schema.js';
import { User, UserSchema } from './user.schema.js';
import { XpAward, XpAwardSchema } from './xp-award.schema.js';

export const schemas: ModelDefinition[] = [
  { name: User.name, schema: UserSchema },
  { name: QuestTemplate.name, schema: QuestTemplateSchema },
  { name: QuestPoolBatch.name, schema: QuestPoolBatchSchema },
  { name: Quest.name, schema: QuestSchema },
  { name: QuestAcceptance.name, schema: QuestAcceptanceSchema },
  { name: SubmissionAttempt.name, schema: SubmissionAttemptSchema },
  { name: QuestCompletion.name, schema: QuestCompletionSchema },
  { name: XpAward.name, schema: XpAwardSchema },
];
