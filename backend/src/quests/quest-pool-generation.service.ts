import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { ClientSession, Connection, Model } from 'mongoose';
import { QuestPoolBatch } from '../database/schemas/quest-pool-batch.schema.js';
import { Quest } from '../database/schemas/quest.schema.js';
import { QuestTemplate, QUEST_REGIONS, type QuestRegion } from '../database/schemas/quest-template.schema.js';
import type { QuestRarity } from '../database/schemas/quest-template.schema.js';
import {
  PublishGeneratedQuestPoolDto,
  PublishGeneratedQuestPoolResponseDto,
  QuestPoolTemplatesResponseDto,
} from './dto/quest-pool-generation.dto.js';

const POOL_PROMPT_VERSION = 'quest-pool-v1';
const POOL_MIN_SIZE = 5;
const POOL_MAX_SIZE = 10;
const XP_BY_RARITY: Record<QuestRarity, number> = {
  common: 25,
  uncommon: 50,
  rare: 100,
};
const DURATION_BY_RARITY: Record<QuestRarity, { min: number; max: number }> = {
  common: { min: 10, max: 30 },
  uncommon: { min: 30, max: 60 },
  rare: { min: 60, max: 120 },
};

interface GeneratedCandidate {
  templateId: string;
  title: string;
  description: string;
  durationMinutes: number;
}

interface PublishRequest {
  poolDate: unknown;
  region?: unknown;
  model: unknown;
  quests: unknown;
}

@Injectable()
export class QuestPoolGenerationService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(QuestTemplate.name)
    private readonly questTemplateModel: Model<QuestTemplate>,
    @InjectModel(QuestPoolBatch.name)
    private readonly questPoolBatchModel: Model<QuestPoolBatch>,
    @InjectModel(Quest.name) private readonly questModel: Model<Quest>,
  ) {}

  async getTemplates(rawRegion?: string): Promise<QuestPoolTemplatesResponseDto> {
    const region: QuestRegion = rawRegion === 'Tobago' ? 'Tobago' : 'Trinidad';
    const templates = await this.questTemplateModel
      .find({ active: true, allowedRegions: region })
      .sort({ _id: 1 })
      .lean()
      .exec();

    if (templates.length < POOL_MIN_SIZE) {
      throw new ServiceUnavailableException({
        code: 'not_enough_active_quest_templates',
        message: `At least five active ${region} quest templates are required.`,
      });
    }

    const poolDate = getTrinidadDate(new Date());
    const existingBatch = await this.questPoolBatchModel
      .findOne({ region, poolDate, status: 'published' })
      .select({ _id: 1 })
      .lean()
      .exec();
    const requestedBatch = await this.questPoolBatchModel
      .findOne({ region, poolDate, status: 'generating' })
      .select({ _id: 1 })
      .lean()
      .exec();

    return {
      poolDate,
      region,
      poolAlreadyPublished: Boolean(existingBatch),
      generationRequested: Boolean(requestedBatch),
      templates: templates.slice(0, POOL_MAX_SIZE).map((template) => ({
        id: template._id.toString(),
        version: template.version,
        rarity: template.rarity,
        difficulty: template.difficulty,
        activityShape: template.activityShape,
        generationGuidance: template.generationGuidance,
        completionCriteria: [...template.completionCriteria],
        proofInstructions: template.proofInstructions,
        safetyGuidance: [...template.safetyGuidance],
      })),
    };
  }

  async requestPoolGeneration(
    poolDate: string,
    now = new Date(),
    region: QuestRegion = 'Trinidad',
  ): Promise<void> {
    if (poolDate !== getTrinidadDate(now)) return;
    const existing = await this.questPoolBatchModel
      .findOne({ region, poolDate })
      .lean()
      .exec();
    if (existing?.status === 'published' || existing?.status === 'generating') return;
    if (existing) {
      await this.questPoolBatchModel.updateOne(
        { _id: existing._id, status: 'failed' },
        { $set: { status: 'generating', startedAt: now, errorCode: null } },
      );
      return;
    }

    try {
      await this.questPoolBatchModel.create({
        poolDate,
        region,
        status: 'generating',
        questCount: 0,
        model: 'gemma4:e2b-it-qat',
        promptVersion: POOL_PROMPT_VERSION,
        startedAt: now,
        publishedAt: null,
        errorCode: null,
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      // A simultaneous site request already created today's generation request.
    }
  }

  async publishPool(
    rawRequest: PublishGeneratedQuestPoolDto,
    now = new Date(),
  ): Promise<PublishGeneratedQuestPoolResponseDto> {
    const request = validatePoolRequest(rawRequest as PublishRequest);
    const region = request.region ?? 'Trinidad';
    const today = getTrinidadDate(now);
    if (request.poolDate !== today) {
      throw new ConflictException({
        code: 'quest_pool_date_mismatch',
        message: 'A generated pool can only be published for today.',
      });
    }

    const existing = await this.questPoolBatchModel
      .findOne({ region, poolDate: today })
      .lean()
      .exec();
    if (existing?.status === 'published') {
      return this.handleExistingBatch(existing, request.model, today);
    }

    const templateIds = request.quests.map(
      (candidate) => new Types.ObjectId(candidate.templateId),
    );
    const templates = await this.questTemplateModel
      .find({
        _id: { $in: templateIds },
        active: true,
        allowedRegions: region,
      })
      .lean()
      .exec();
    const byId = new Map(templates.map((template) => [template._id.toString(), template]));
    if (byId.size !== request.quests.length) {
      throw new BadRequestException({
        code: 'invalid_quest_template',
        message: `Every generated quest must reference a unique active ${region} template.`,
      });
    }

    const seenTitles = new Set<string>();
    const questDocs = request.quests.map((candidate, slot) => {
      const template = byId.get(candidate.templateId);
      if (!template) {
        throw new BadRequestException({
          code: 'invalid_quest_template',
          message: 'A generated quest references an unavailable template.',
        });
      }
      const titleKey = candidate.title.toLocaleLowerCase('en');
      if (seenTitles.has(titleKey)) {
        throw new BadRequestException({
          code: 'duplicate_quest_title',
          message: 'Generated quest titles must be unique within the pool.',
        });
      }
      seenTitles.add(titleKey);
      const durationBand = DURATION_BY_RARITY[template.rarity];
      if (
        candidate.durationMinutes < durationBand.min ||
        candidate.durationMinutes > durationBand.max
      ) {
        throw new BadRequestException({
          code: 'invalid_quest_duration',
          message: 'Generated quest duration must fit its template rarity.',
        });
      }

      const instructionsLower = template.proofInstructions.toLowerCase();
      const titleLower = candidate.title.toLowerCase();
      const descLower = candidate.description.toLowerCase();
      const isPhotoProof =
        instructionsLower.includes('photo') ||
        instructionsLower.includes('picture') ||
        titleLower.includes('photo') ||
        titleLower.includes('picture') ||
        descLower.includes('photo') ||
        descLower.includes('picture') ||
        descLower.includes('snap');

      return new this.questModel({
        batchId: new Types.ObjectId(),
        slot,
        templateId: template._id,
        templateVersion: template.version,
        title: candidate.title,
        description: candidate.description,
        region,
        localContext: null,
        durationMinutes: candidate.durationMinutes,
        difficulty: template.difficulty,
        rarity: template.rarity,
        xp: XP_BY_RARITY[template.rarity],
        proofType: isPhotoProof ? 'photo' : 'text',
        proofInstructions: template.proofInstructions,
        completionCriteria: [...template.completionCriteria],
        safetyGuidance: [...template.safetyGuidance],
        generatedBy: 'gemma',
        model: request.model,
        promptVersion: POOL_PROMPT_VERSION,
        availableOn: today,
        expiresAt: null,
        status: 'available',
        createdAt: now,
      });
    });

    const batchId = existing?._id ?? new Types.ObjectId();
    for (const quest of questDocs) {
      quest.batchId = batchId;
      await quest.validate();
    }
    const batch = new this.questPoolBatchModel({
      _id: batchId,
      poolDate: today,
      region: 'Trinidad',
      status: 'generating',
      questCount: questDocs.length,
      model: request.model,
      promptVersion: POOL_PROMPT_VERSION,
      startedAt: now,
      publishedAt: null,
      errorCode: null,
    });
    await batch.validate();

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        if (existing) {
          await this.questPoolBatchModel.updateOne(
            { _id: batchId, status: existing.status },
            {
              $set: {
                status: 'generating',
                questCount: questDocs.length,
                model: request.model,
                promptVersion: POOL_PROMPT_VERSION,
                startedAt: now,
                publishedAt: null,
                errorCode: null,
              },
            },
            { session },
          );
        } else {
          await batch.save({ session });
        }
        await this.questModel.insertMany(questDocs, {
          session,
          ordered: true,
        });
        await this.questPoolBatchModel.updateOne(
          { _id: batchId, status: 'generating' },
          { $set: { status: 'published', publishedAt: now } },
          { session },
        );
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const racedBatch = await this.questPoolBatchModel
          .findOne({ region: 'Trinidad', poolDate: today })
          .lean()
          .exec();
        if (racedBatch) {
          return this.handleExistingBatch(racedBatch, request.model, today);
        }
      }
      throw error;
    } finally {
      await session.endSession();
    }

    return {
      published: true,
      alreadyPublished: false,
      batchId: batchId.toString(),
      poolDate: today,
      questCount: questDocs.length,
      model: request.model,
    };
  }

  private handleExistingBatch(
    batch: {
      _id: Types.ObjectId;
      status: QuestPoolBatch['status'];
      questCount: number;
      model: string;
      promptVersion: string;
    },
    requestedModel: string,
    poolDate: string,
  ): PublishGeneratedQuestPoolResponseDto {
    if (
      batch.status === 'published' &&
      batch.model === requestedModel &&
      batch.promptVersion === POOL_PROMPT_VERSION
    ) {
      return {
        published: false,
        alreadyPublished: true,
        batchId: batch._id.toString(),
        poolDate,
        questCount: batch.questCount,
        model: batch.model,
      };
    }
    throw new ConflictException({
      code: 'quest_pool_already_exists',
      message:
        'A quest pool already exists for today. The existing published pool was left unchanged.',
    });
  }
}

function validatePoolRequest(raw: PublishRequest): {
  poolDate: string;
  region: QuestRegion;
  model: string;
  quests: GeneratedCandidate[];
} {
  if (!isRecord(raw)) {
    throw invalidPool();
  }
  const hasRegion = Object.hasOwn(raw, 'region');
  const expectedKeys = hasRegion
    ? ['poolDate', 'region', 'model', 'quests']
    : ['poolDate', 'model', 'quests'];
  if (!hasExactKeys(raw, expectedKeys)) {
    throw invalidPool();
  }
  const region: QuestRegion = raw.region === 'Tobago' ? 'Tobago' : 'Trinidad';
  if (
    typeof raw.poolDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(raw.poolDate) ||
    typeof raw.model !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/.test(raw.model) ||
    !Array.isArray(raw.quests) ||
    raw.quests.length < POOL_MIN_SIZE ||
    raw.quests.length > POOL_MAX_SIZE
  ) {
    throw invalidPool();
  }

  const quests = raw.quests.map((candidate): GeneratedCandidate => {
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, [
        'templateId',
        'title',
        'description',
        'durationMinutes',
      ]) ||
      typeof candidate.templateId !== 'string' ||
      !/^[a-f\d]{24}$/i.test(candidate.templateId) ||
      typeof candidate.title !== 'string' ||
      typeof candidate.description !== 'string' ||
      !Number.isInteger(candidate.durationMinutes)
    ) {
      throw invalidPool();
    }
    const title = candidate.title.trim();
    const description = candidate.description.trim();
    if (
      title.length < 3 ||
      title.length > 120 ||
      description.length < 20 ||
      description.length > 2000
    ) {
      throw invalidPool();
    }
    return {
      templateId: candidate.templateId.toLowerCase(),
      title,
      description,
      durationMinutes: candidate.durationMinutes as number,
    };
  });

  if (new Set(quests.map((quest) => quest.templateId)).size !== quests.length) {
    throw invalidPool();
  }
  return {
    poolDate: raw.poolDate as string,
    region,
    model: raw.model as string,
    quests,
  };
}

function invalidPool(): BadRequestException {
  return new BadRequestException({
    code: 'invalid_generated_quest_pool',
    message: 'The generated quest pool did not match the required format.',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: string[],
): boolean {
  const actual = Object.keys(value).sort();
  return (
    actual.length === keys.length &&
    actual.every((key, index) => key === [...keys].sort()[index])
  );
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

function getTrinidadDate(date: Date): string {
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
