import { ApiProperty } from '@nestjs/swagger';

export class QuestTemplateForGenerationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty({ enum: ['common', 'uncommon', 'rare'] })
  rarity!: 'common' | 'uncommon' | 'rare';

  @ApiProperty({ enum: ['easy', 'moderate', 'challenging'] })
  difficulty!: 'easy' | 'moderate' | 'challenging';

  @ApiProperty()
  activityShape!: string;

  @ApiProperty()
  generationGuidance!: string;

  @ApiProperty({ type: [String] })
  completionCriteria!: string[];

  @ApiProperty()
  proofInstructions!: string;

  @ApiProperty({ type: [String] })
  safetyGuidance!: string[];
}

export class QuestPoolTemplatesResponseDto {
  @ApiProperty({ example: '2026-10-10' })
  poolDate!: string;

  @ApiProperty({
    description: 'True when a published pool already exists for poolDate.',
  })
  poolAlreadyPublished!: boolean;

  @ApiProperty({
    description: 'True when the site has requested generation for poolDate and no pool is published yet.',
  })
  generationRequested!: boolean;

  @ApiProperty({ type: [QuestTemplateForGenerationDto] })
  templates!: QuestTemplateForGenerationDto[];
}

export class GeneratedQuestCandidateDto {
  @ApiProperty({ description: 'ID of an active human-reviewed template.' })
  templateId!: string;

  @ApiProperty({ maxLength: 120 })
  title!: string;

  @ApiProperty({ maxLength: 2000 })
  description!: string;

  @ApiProperty({ minimum: 10, maximum: 120 })
  durationMinutes!: number;
}

export class PublishGeneratedQuestPoolDto {
  @ApiProperty({ example: '2026-10-10' })
  poolDate!: string;

  @ApiProperty({ example: 'gemma4:e2b-it-qat' })
  model!: string;

  @ApiProperty({ type: [GeneratedQuestCandidateDto], minItems: 5, maxItems: 10 })
  quests!: GeneratedQuestCandidateDto[];
}

export class PublishGeneratedQuestPoolResponseDto {
  @ApiProperty()
  published!: boolean;

  @ApiProperty()
  alreadyPublished!: boolean;

  @ApiProperty()
  batchId!: string;

  @ApiProperty({ example: '2026-10-10' })
  poolDate!: string;

  @ApiProperty()
  questCount!: number;

  @ApiProperty()
  model!: string;
}
