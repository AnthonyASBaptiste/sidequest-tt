import { ApiProperty } from '@nestjs/swagger';
import type {
  QuestDifficulty,
  QuestRarity,
} from '../../database/schemas/quest-template.schema.js';

export class TodaysQuestDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id!: string;

  @ApiProperty({ example: 0 })
  slot!: number;

  @ApiProperty({ example: 'Notice a New Detail' })
  title!: string;

  @ApiProperty({
    example:
      'Spend a few minutes noticing details in a public place you already visit.',
  })
  description!: string;

  @ApiProperty({ enum: ['Trinidad', 'Tobago'], example: 'Trinidad' })
  region!: 'Trinidad' | 'Tobago';

  @ApiProperty({ example: 15, minimum: 10, maximum: 120 })
  durationMinutes!: number;

  @ApiProperty({ enum: ['easy', 'moderate', 'challenging'], example: 'easy' })
  difficulty!: QuestDifficulty;

  @ApiProperty({ enum: ['common', 'uncommon', 'rare'], example: 'common' })
  rarity!: QuestRarity;

  @ApiProperty({ enum: [25, 50, 100], example: 25 })
  xp!: number;

  @ApiProperty({ enum: ['text', 'photo'], example: 'text' })
  proofType!: 'text' | 'photo';

  @ApiProperty({ example: 'Describe three details you noticed.' })
  proofInstructions!: string;

  @ApiProperty({ type: [String], example: ['Describe three distinct details.'] })
  completionCriteria!: string[];

  @ApiProperty({ type: [String], example: ['Stay in a public area.'] })
  safetyGuidance!: string[];

  @ApiProperty({
    example: '2026-10-07T16:15:00.000Z',
    nullable: true,
    description: 'Most recent completion time for this guest and quest.',
  })
  lastCompletedAt!: string | null;

  @ApiProperty({
    example: false,
    description: 'Whether the guest completed this quest instance today in Trinidad.',
  })
  completedToday!: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether the most recent completion date was yesterday in Trinidad.',
  })
  completedYesterday!: boolean;
}

export class TodayQuestBoardDto {
  @ApiProperty({
    example: true,
    description: 'False only when no published quest pool exists.',
  })
  available!: boolean;

  @ApiProperty({
    example: '2026-10-08',
    type: String,
    nullable: true,
    description: 'Trinidad calendar date of the pool being returned.',
  })
  poolDate!: string | null;

  @ApiProperty({
    example: false,
    description: 'True when serving an older pool because today has none.',
  })
  fallback!: boolean;

  @ApiProperty({
    description: 'True while the home-server worker is generating the requested pool for today.',
  })
  generationRequested!: boolean;

  @ApiProperty({
    example: 'Trinidad',
    enum: ['Trinidad', 'Tobago'],
    description: 'Island region of the quest board.',
  })
  region?: 'Trinidad' | 'Tobago';

  @ApiProperty({
    example: 'Divali & Heritage Season',
    description: 'Active cultural or festival season detected for this date and island.',
    required: false,
  })
  seasonName?: string;

  @ApiProperty({
    example: 'Divali Nagar in Chaguanas, deya lighting...',
    description: 'Cultural themes informing today’s quests.',
    required: false,
  })
  seasonThemes?: string;

  @ApiProperty({ type: [TodaysQuestDto] })
  quests!: TodaysQuestDto[];
}

export class QuestBoardUnavailableDto {
  @ApiProperty({ example: false })
  available!: false;

  @ApiProperty({
    example: 'no_published_pool',
    description: 'Machine-readable reason the quest board is unavailable.',
  })
  reason!: 'no_published_pool';

  @ApiProperty({ example: null, type: String, nullable: true })
  poolDate!: null;

  @ApiProperty({ example: false })
  fallback!: false;

  @ApiProperty({ example: true })
  generationRequested!: true;

  @ApiProperty({ type: [TodaysQuestDto] })
  quests!: [];
}
