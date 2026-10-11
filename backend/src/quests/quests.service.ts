import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  QuestAcceptance,
  type AcceptedQuestSnapshot,
} from '../database/schemas/quest-acceptance.schema.js';
import { QuestCompletion } from '../database/schemas/quest-completion.schema.js';
import { QuestPoolBatch } from '../database/schemas/quest-pool-batch.schema.js';
import { QuestPoolGenerationService } from './quest-pool-generation.service.js';
import { Quest } from '../database/schemas/quest.schema.js';
import { SubmissionAttempt } from '../database/schemas/submission-attempt.schema.js';
import {
  ActiveQuestResponseDto,
  RecentQuestCompletionDto,
} from './dto/active-quest.dto.js';
import { QuestAcceptanceDto } from './dto/quest-acceptance.dto.js';
import {
  TodayQuestBoardDto,
  TodaysQuestDto,
} from './dto/todays-quest.dto.js';

interface AcceptanceRecord {
  _id: Types.ObjectId;
  questId: Types.ObjectId;
  status: QuestAcceptance['status'];
  acceptedAt: Date;
  questSnapshot: AcceptedQuestSnapshot;
}

interface LatestSubmissionRecord {
  _id: Types.ObjectId;
  acceptanceId: Types.ObjectId;
  attemptNumber: number;
  status: SubmissionAttempt['status'];
  verification: SubmissionAttempt['verification'];
  xpAwarded: number;
  createdAt: Date;
}

interface CompletionRecord {
  acceptanceId: Types.ObjectId;
  winningAttemptId: Types.ObjectId;
  completedAt: Date;
}

@Injectable()
export class QuestsService {
  constructor(
    @InjectModel(QuestPoolBatch.name)
    private readonly questPoolBatchModel: Model<QuestPoolBatch>,
    @InjectModel(Quest.name)
    private readonly questModel: Model<Quest>,
    @InjectModel(QuestCompletion.name)
    private readonly questCompletionModel: Model<QuestCompletion>,
    @InjectModel(QuestAcceptance.name)
    private readonly questAcceptanceModel: Model<QuestAcceptance>,
    @InjectModel(SubmissionAttempt.name)
    private readonly submissionAttemptModel: Model<SubmissionAttempt>,
    private readonly questPoolGenerationService: QuestPoolGenerationService,
  ) {}

  async getActiveQuest(
    userId: Types.ObjectId,
  ): Promise<ActiveQuestResponseDto> {
    const acceptance = await this.questAcceptanceModel
      .findOne({ activeUserId: userId })
      .select({
        _id: 1,
        questId: 1,
        status: 1,
        acceptedAt: 1,
        questSnapshot: 1,
      })
      .lean<AcceptanceRecord>()
      .exec();

    if (!acceptance) {
      return {
        activeAcceptance: null,
        latestSubmission: null,
        recentCompletion: await this.getRecentCompletion(userId),
      };
    }

    const latestSubmission = await this.submissionAttemptModel
      .findOne({ acceptanceId: acceptance._id })
      .select({
        _id: 1,
        acceptanceId: 1,
        attemptNumber: 1,
        status: 1,
        verification: 1,
        xpAwarded: 1,
        createdAt: 1,
      })
      .sort({ attemptNumber: -1 })
      .lean<LatestSubmissionRecord>()
      .exec();

    return {
      activeAcceptance: this.toAcceptanceDto(acceptance),
      latestSubmission: latestSubmission
        ? this.toSubmissionStatus(latestSubmission)
        : null,
      recentCompletion: null,
    };
  }

  private async getRecentCompletion(
    userId: Types.ObjectId,
  ): Promise<RecentQuestCompletionDto | null> {
    const completion = await this.questCompletionModel
      .findOne({ userId })
      .select({ acceptanceId: 1, winningAttemptId: 1, completedAt: 1 })
      .sort({ completedAt: -1 })
      .lean<CompletionRecord>()
      .exec();
    if (!completion) return null;

    const [acceptance, submission] = await Promise.all([
      this.questAcceptanceModel
        .findOne({
          _id: completion.acceptanceId,
          userId,
          status: 'completed',
        })
        .select({ _id: 1, questId: 1, status: 1, acceptedAt: 1, questSnapshot: 1 })
        .lean<AcceptanceRecord>()
        .exec(),
      this.submissionAttemptModel
        .findOne({
          _id: completion.winningAttemptId,
          acceptanceId: completion.acceptanceId,
          status: 'verified',
        })
        .select({
          _id: 1,
          acceptanceId: 1,
          attemptNumber: 1,
          status: 1,
          verification: 1,
          xpAwarded: 1,
          createdAt: 1,
        })
        .lean<LatestSubmissionRecord>()
        .exec(),
    ]);

    if (!acceptance || !submission) return null;
    return {
      acceptance: this.toAcceptanceDto(acceptance),
      submission: this.toSubmissionStatus(submission),
      completedAt: completion.completedAt.toISOString(),
    };
  }

  private toSubmissionStatus(submission: LatestSubmissionRecord) {
    return {
      attemptId: submission._id.toString(),
      acceptanceId: submission.acceptanceId.toString(),
      attemptNumber: submission.attemptNumber,
      status: submission.status,
      reason: submission.verification.reason,
      confidence: submission.verification.confidence,
      failedCriteria: [...submission.verification.failedCriteria],
      xpAwarded: submission.xpAwarded,
      submittedAt: submission.createdAt.toISOString(),
    };
  }

  async getTodaysQuestBoard(
    userId: Types.ObjectId,
    now = new Date(),
  ): Promise<TodayQuestBoardDto> {
    const today = getTrinidadDate(now);
    const yesterday = getPreviousTrinidadDate(today);
    const batch = await this.getCurrentPublishedBatch(today);

    if (!batch) {
      await this.questPoolGenerationService.requestPoolGeneration(today, now);
    }

    if (!batch) {
      throw new ServiceUnavailableException({
        available: false,
        reason: 'no_published_pool',
        poolDate: null,
        fallback: false,
        generationRequested: true,
        quests: [],
      });
    }

    const quests = await this.questModel
      .find({
        batchId: batch._id as Types.ObjectId,
        status: 'available',
      })
      .select({
        _id: 1,
        slot: 1,
        title: 1,
        description: 1,
        region: 1,
        durationMinutes: 1,
        difficulty: 1,
        rarity: 1,
        xp: 1,
        proofType: 1,
        proofInstructions: 1,
        completionCriteria: 1,
        safetyGuidance: 1,
      })
      .sort({ slot: 1 })
      .lean()
      .exec();

    const completions =
      quests.length === 0
        ? []
        : await this.questCompletionModel
            .find({
              userId,
              questId: { $in: quests.map((quest) => quest._id) },
            })
            .select({ questId: 1, completedAt: 1 })
            .sort({ completedAt: -1 })
            .lean()
            .exec();
    const latestCompletionByQuest = new Map<string, Date>();
    for (const completion of completions) {
      const questId = completion.questId.toString();
      if (!latestCompletionByQuest.has(questId)) {
        latestCompletionByQuest.set(questId, completion.completedAt);
      }
    }

    return {
      available: true,
      poolDate: batch.poolDate,
      fallback: batch.poolDate !== today,
      generationRequested: batch.poolDate !== today,
      quests: quests.map((quest): TodaysQuestDto => {
        const lastCompletedAt =
          latestCompletionByQuest.get(quest._id.toString()) ?? null;
        return {
          id: quest._id.toString(),
          slot: quest.slot,
          title: quest.title,
          description: quest.description,
          region: quest.region,
          durationMinutes: quest.durationMinutes,
          difficulty: quest.difficulty,
          rarity: quest.rarity,
          xp: quest.xp,
          proofType: quest.proofType,
          proofInstructions: quest.proofInstructions,
          completionCriteria: quest.completionCriteria,
          safetyGuidance: quest.safetyGuidance,
          lastCompletedAt: lastCompletedAt?.toISOString() ?? null,
          completedToday:
            lastCompletedAt !== null &&
            getTrinidadDate(lastCompletedAt) === today,
          completedYesterday:
            lastCompletedAt !== null &&
            getTrinidadDate(lastCompletedAt) === yesterday,
        };
      }),
    };
  }

  async acceptQuest(
    userId: Types.ObjectId,
    questId: string,
    now = new Date(),
  ): Promise<{ acceptance: QuestAcceptanceDto; created: boolean }> {
    const activeAcceptance = await this.findActiveAcceptance(userId);
    if (activeAcceptance) {
      return this.resolveExistingActiveAcceptance(activeAcceptance, questId);
    }

    const today = getTrinidadDate(now);
    const batch = await this.getCurrentPublishedBatch(today);
    if (!batch) {
      throw this.questUnavailable();
    }

    const quest = await this.questModel
      .findOne({
        _id: new Types.ObjectId(questId),
        batchId: batch._id,
        status: 'available',
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      })
      .select({
        title: 1,
        description: 1,
        region: 1,
        durationMinutes: 1,
        difficulty: 1,
        rarity: 1,
        xp: 1,
        proofInstructions: 1,
        completionCriteria: 1,
        safetyGuidance: 1,
      })
      .lean()
      .exec();

    if (!quest) {
      throw this.questUnavailable();
    }

    const priorAcceptance = await this.questAcceptanceModel
      .findOne({ userId, questId: quest._id })
      .sort({ acceptanceNumber: -1 })
      .select({ acceptanceNumber: 1 })
      .lean()
      .exec();
    const questSnapshot: AcceptedQuestSnapshot = {
      title: quest.title,
      description: quest.description,
      region: quest.region,
      durationMinutes: quest.durationMinutes,
      difficulty: quest.difficulty,
      rarity: quest.rarity,
      xp: quest.xp,
      proofInstructions: quest.proofInstructions,
      completionCriteria: [...quest.completionCriteria],
      safetyGuidance: [...quest.safetyGuidance],
    };

    try {
      const acceptance = await this.questAcceptanceModel.create({
        userId,
        questId: quest._id,
        acceptanceNumber: (priorAcceptance?.acceptanceNumber ?? 0) + 1,
        activeUserId: userId,
        questSnapshot,
        status: 'accepted',
        acceptedAt: now,
        updatedAt: now,
      });
      return {
        acceptance: this.toAcceptanceDto(acceptance),
        created: true,
      };
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      const winningAcceptance = await this.findActiveAcceptance(userId);
      if (winningAcceptance) {
        return this.resolveExistingActiveAcceptance(winningAcceptance, questId);
      }

      throw new ConflictException({
        code: 'acceptance_conflict',
        message:
          'Another acceptance request won the active-quest constraint. Please retry.',
      });
    }
  }

  private async getCurrentPublishedBatch(today: string) {
    const todaysBatch = await this.questPoolBatchModel
      .findOne({ region: 'Trinidad', poolDate: today, status: 'published' })
      .select({ _id: 1, poolDate: 1 })
      .lean()
      .exec();

    return (
      todaysBatch ??
      (await this.questPoolBatchModel
        .findOne({ region: 'Trinidad', status: 'published' })
        .sort({ poolDate: -1, publishedAt: -1 })
        .select({ _id: 1, poolDate: 1 })
        .lean()
        .exec())
    );
  }

  private async findActiveAcceptance(userId: Types.ObjectId) {
    return this.questAcceptanceModel
      .findOne({ activeUserId: userId })
      .lean<AcceptanceRecord>()
      .exec();
  }

  private resolveExistingActiveAcceptance(
    acceptance: AcceptanceRecord,
    requestedQuestId: string,
  ): { acceptance: QuestAcceptanceDto; created: false } {
    if (acceptance.questId.toString() !== requestedQuestId) {
      throw new ConflictException({
        code: 'active_quest_exists',
        message: 'You already have a different active quest.',
        activeAcceptanceId: acceptance._id.toString(),
        activeQuestId: acceptance.questId.toString(),
      });
    }

    return {
      acceptance: this.toAcceptanceDto(acceptance),
      created: false,
    };
  }

  private toAcceptanceDto(
    acceptance: AcceptanceRecord,
  ): QuestAcceptanceDto {
    return {
      id: acceptance._id.toString(),
      questId: acceptance.questId.toString(),
      status: acceptance.status,
      acceptedAt: acceptance.acceptedAt.toISOString(),
      questSnapshot: {
        title: acceptance.questSnapshot.title,
        description: acceptance.questSnapshot.description,
        region: acceptance.questSnapshot.region,
        durationMinutes: acceptance.questSnapshot.durationMinutes,
        difficulty: acceptance.questSnapshot.difficulty,
        rarity: acceptance.questSnapshot.rarity,
        xp: acceptance.questSnapshot.xp,
        proofInstructions: acceptance.questSnapshot.proofInstructions,
        completionCriteria: [...acceptance.questSnapshot.completionCriteria],
        safetyGuidance: [...acceptance.questSnapshot.safetyGuidance],
      },
    };
  }

  private questUnavailable(): NotFoundException {
    return new NotFoundException({
      code: 'quest_unavailable',
      message: 'This quest is not available in the current published pool.',
    });
  }

}

export function getTrinidadDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Port_of_Spain',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map(({ type, value }) => [type, value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function getPreviousTrinidadDate(today: string): string {
  const date = new Date(`${today}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return getTrinidadDate(date);
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}
