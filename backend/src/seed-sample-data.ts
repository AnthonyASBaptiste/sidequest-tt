import { createHash } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppModule } from './app.module.js';
import { QuestPoolBatch } from './database/schemas/quest-pool-batch.schema.js';
import { Quest } from './database/schemas/quest.schema.js';
import {
  QuestDifficulty,
  QuestRarity,
  QuestTemplate,
} from './database/schemas/quest-template.schema.js';

interface SampleQuest {
  key: string;
  rarity: QuestRarity;
  difficulty: QuestDifficulty;
  activityShape: string;
  generationGuidance: string;
  title: string;
  description: string;
  durationMinutes: number;
  proofInstructions: string;
  completionCriteria: string[];
  safetyGuidance: string[];
}

const SAMPLE_QUESTS: SampleQuest[] = [
  {
    key: 'notice-a-new-detail',
    rarity: 'common',
    difficulty: 'easy',
    activityShape: 'Observe overlooked details in an already accessible public place.',
    generationGuidance:
      'Keep the task observational and possible without buying anything or taking a photo.',
    title: 'Notice a New Detail',
    description:
      'Spend a few minutes noticing details in a public place you already visit. Find three things you have not paid attention to before.',
    durationMinutes: 15,
    proofInstructions:
      'In a few sentences, describe the three details and which one surprised you most.',
    completionCriteria: [
      'The response describes three distinct details.',
      'The response identifies one detail that was surprising or newly noticed.',
    ],
    safetyGuidance: [
      'Choose a place you can access safely and lawfully.',
      'Stay aware of your surroundings; do not enter restricted areas.',
    ],
  },
  {
    key: 'take-a-safe-detour',
    rarity: 'common',
    difficulty: 'easy',
    activityShape: 'Take a different safe route during a familiar outing.',
    generationGuidance:
      'Do not require a particular destination, transport mode, or unsafe route.',
    title: 'The Safe Detour',
    description:
      'During an outing you already planned, choose a different route only if it feels safe and convenient. Notice one thing you would have missed on your usual way.',
    durationMinutes: 20,
    proofInstructions:
      'Describe the new detail you noticed and how the route differed from your usual one.',
    completionCriteria: [
      'The response identifies a difference from the usual route.',
      'The response describes one observation made along the detour.',
    ],
    safetyGuidance: [
      'Do not take a route that feels unsafe or requires trespassing.',
      'Keep your usual transport and personal safety needs in mind.',
    ],
  },
  {
    key: 'explore-a-nearby-public-place',
    rarity: 'uncommon',
    difficulty: 'moderate',
    activityShape: 'Explore an accessible public area at an unhurried pace.',
    generationGuidance:
      'Keep exploration within a place the player can safely access; no admission or purchase may be required.',
    title: 'A Closer Look Nearby',
    description:
      'Choose an accessible public area near somewhere you already go. Explore at an unhurried pace and notice how people use the space.',
    durationMinutes: 40,
    proofInstructions:
      'Describe two details about the space and one way people use it.',
    completionCriteria: [
      'The response gives two distinct observations about the space.',
      'The response describes one observed or apparent use of the space.',
    ],
    safetyGuidance: [
      'Choose a public place that is open and comfortable to visit.',
      'Do not approach or photograph strangers; keep a respectful distance.',
    ],
  },
  {
    key: 'find-a-new-resting-spot',
    rarity: 'uncommon',
    difficulty: 'moderate',
    activityShape: 'Spend time in a different accessible public resting spot.',
    generationGuidance:
      'The activity must be free, optional to leave at any time, and not depend on a specific named venue.',
    title: 'A Different Place to Pause',
    description:
      'Find a different safe, public place to sit or pause during your day. Spend a little time there without needing to buy anything.',
    durationMinutes: 35,
    proofInstructions:
      'Write what made the spot different from your usual places to pause.',
    completionCriteria: [
      'The response describes a place different from the player’s usual resting spots.',
      'The response gives at least one sensory or environmental observation.',
    ],
    safetyGuidance: [
      'Use a place that is publicly accessible and where you feel safe.',
      'Leave whenever you feel uncomfortable; do not enter private property.',
    ],
  },
  {
    key: 'three-part-place-story',
    rarity: 'rare',
    difficulty: 'challenging',
    activityShape: 'Complete a multi-step observation quest in an accessible public area.',
    generationGuidance:
      'Keep all steps in one safe, accessible public area; require no purchase, vehicle, or photography.',
    title: 'Three-Part Place Story',
    description:
      'Spend time in one accessible public area. Notice a detail in the environment, consider how the space is used, then reflect on how it makes you feel.',
    durationMinutes: 75,
    proofInstructions:
      'Submit a short reflection covering one environmental detail, one observation about the space’s use, and your own response to being there.',
    completionCriteria: [
      'The response includes a concrete environmental detail.',
      'The response reflects on how the space is used.',
      'The response includes the player’s own reaction or reflection.',
    ],
    safetyGuidance: [
      'Choose an open public area you can access safely and lawfully.',
      'Stay in public areas and leave if conditions become uncomfortable.',
    ],
  },
];

function currentTrinidadDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Port_of_Spain',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const dateParts = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value]),
  );
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function stableObjectId(key: string): Types.ObjectId {
  const hex = createHash('sha256').update(key).digest('hex').slice(0, 24);
  return new Types.ObjectId(hex);
}

async function seedSampleData(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const templateModel = app.get<Model<QuestTemplate>>(
      getModelToken(QuestTemplate.name),
    );
    const batchModel = app.get<Model<QuestPoolBatch>>(
      getModelToken(QuestPoolBatch.name),
    );
    const questModel = app.get<Model<Quest>>(getModelToken(Quest.name));

    const poolDate = currentTrinidadDate();
    const batchId = stableObjectId(`sidequest-sample-pool-${poolDate}`);
    const existingBatch = await batchModel
      .findOne({ region: 'Trinidad', poolDate })
      .lean();

    if (existingBatch && existingBatch._id.toString() !== batchId.toString()) {
      throw new Error(
        `A different Trinidad quest pool already exists for ${poolDate}; refusing to modify it.`,
      );
    }

    if (existingBatch?.status === 'published') {
      console.log(
        `A published pool already exists for ${poolDate}; no sample data was changed.`,
      );
      return;
    }

    const now = new Date();
    const promptVersion = 'sample-seed-v1';
    const templates = SAMPLE_QUESTS.map((sample) => {
      const id = stableObjectId(`sidequest-sample-template-${sample.key}`);
      return new templateModel({
        _id: id,
        version: 1,
        active: true,
        rarity: sample.rarity,
        difficulty: sample.difficulty,
        activityShape: sample.activityShape,
        generationGuidance: sample.generationGuidance,
        completionCriteria: sample.completionCriteria,
        proofInstructions: sample.proofInstructions,
        safetyGuidance: sample.safetyGuidance,
        allowedRegions: ['Trinidad'],
        createdAt: now,
        updatedAt: now,
      });
    });

    const quests = SAMPLE_QUESTS.map((sample, slot) => {
      const templateId = stableObjectId(
        `sidequest-sample-template-${sample.key}`,
      );
      return new questModel({
        _id: stableObjectId(`sidequest-sample-quest-${poolDate}-${sample.key}`),
        batchId,
        slot,
        templateId,
        templateVersion: 1,
        title: sample.title,
        description: sample.description,
        region: 'Trinidad',
        localContext: null,
        durationMinutes: sample.durationMinutes,
        difficulty: sample.difficulty,
        rarity: sample.rarity,
        xp: { common: 25, uncommon: 50, rare: 100 }[sample.rarity],
        proofType: 'text',
        proofInstructions: sample.proofInstructions,
        completionCriteria: sample.completionCriteria,
        safetyGuidance: sample.safetyGuidance,
        generatedBy: 'gemma',
        model: 'sample-data',
        promptVersion,
        availableOn: poolDate,
        expiresAt: null,
        status: 'available',
        createdAt: now,
      });
    });

    const batch = new batchModel({
      _id: batchId,
      poolDate,
      region: 'Trinidad',
      status: 'generating',
      questCount: SAMPLE_QUESTS.length,
      model: 'sample-data',
      promptVersion,
      startedAt: now,
      publishedAt: null,
      errorCode: null,
    });

    await batch.validate();
    for (const template of templates) {
      await template.validate();
    }
    for (const quest of quests) {
      try {
        await quest.validate();
      } catch (error) {
        throw new Error(
          `Sample quest "${quest.title}" failed schema validation: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (!existingBatch) {
      await batch.save();
    }
    for (const template of templates) {
      if (!(await templateModel.exists({ _id: template._id }))) {
        await template.save();
      }
    }
    for (const quest of quests) {
      if (!(await questModel.exists({ _id: quest._id }))) {
        await quest.save();
      }
    }

    await batchModel.updateOne(
      { _id: batchId, status: 'generating' },
      { $set: { status: 'published', publishedAt: new Date() } },
      { runValidators: true },
    );

    console.log(
      `Seeded ${templates.length} templates and ${quests.length} quests for Trinidad pool ${poolDate}.`,
    );
  } finally {
    await app.close();
  }
}

seedSampleData().catch((error: unknown) => {
  console.error(
    'Sample data seed failed:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
