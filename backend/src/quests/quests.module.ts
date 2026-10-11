import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  QuestAcceptance,
  QuestAcceptanceSchema,
} from '../database/schemas/quest-acceptance.schema.js';
import {
  QuestCompletion,
  QuestCompletionSchema,
} from '../database/schemas/quest-completion.schema.js';
import {
  SubmissionAttempt,
  SubmissionAttemptSchema,
} from '../database/schemas/submission-attempt.schema.js';
import {
  QuestPoolBatch,
  QuestPoolBatchSchema,
} from '../database/schemas/quest-pool-batch.schema.js';
import {
  QuestTemplate,
  QuestTemplateSchema,
} from '../database/schemas/quest-template.schema.js';
import { Quest, QuestSchema } from '../database/schemas/quest.schema.js';
import { User, UserSchema } from '../database/schemas/user.schema.js';
import { XpAward, XpAwardSchema } from '../database/schemas/xp-award.schema.js';
import { SessionsModule } from '../sessions/sessions.module.js';
import { VerificationWorkerController } from '../verification/verification-worker.controller.js';
import { VerificationWorkerAuthGuard } from '../verification/worker-auth.guard.js';
import { VerificationWorkerService } from '../verification/verification-worker.service.js';
import { QuestsController } from './quests.controller.js';
import { QuestsService } from './quests.service.js';
import { SubmissionsController } from './submissions.controller.js';
import { SubmissionsService } from './submissions.service.js';
import { QuestPoolGenerationController } from './quest-pool-generation.controller.js';
import { QuestPoolGenerationService } from './quest-pool-generation.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QuestAcceptance.name, schema: QuestAcceptanceSchema },
      { name: SubmissionAttempt.name, schema: SubmissionAttemptSchema },
      { name: QuestPoolBatch.name, schema: QuestPoolBatchSchema },
      { name: QuestTemplate.name, schema: QuestTemplateSchema },
      { name: Quest.name, schema: QuestSchema },
      { name: QuestCompletion.name, schema: QuestCompletionSchema },
      { name: XpAward.name, schema: XpAwardSchema },
      { name: User.name, schema: UserSchema },
    ]),
    SessionsModule,
  ],
  controllers: [
    QuestsController,
    SubmissionsController,
    VerificationWorkerController,
    QuestPoolGenerationController,
  ],
  providers: [
    QuestsService,
    SubmissionsService,
    VerificationWorkerAuthGuard,
    VerificationWorkerService,
    QuestPoolGenerationService,
  ],
})
export class QuestsModule {}
