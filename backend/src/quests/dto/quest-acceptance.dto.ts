import { ApiProperty } from '@nestjs/swagger';
import type { QuestAcceptance as QuestAcceptanceDocument } from '../../database/schemas/quest-acceptance.schema.js';

export class AcceptedQuestSnapshotDto {
  @ApiProperty({ example: 'Notice a New Detail' })
  title!: string;

  @ApiProperty({
    example:
      'Spend a few minutes noticing details in a public place you already visit.',
  })
  description!: string;

  @ApiProperty({ example: 'Trinidad' })
  region!: string;

  @ApiProperty({ example: 15 })
  durationMinutes!: number;

  @ApiProperty({ example: 'easy' })
  difficulty!: string;

  @ApiProperty({ example: 'common' })
  rarity!: string;

  @ApiProperty({ example: 25 })
  xp!: number;

  @ApiProperty({ example: 'Describe three details you noticed.' })
  proofInstructions!: string;

  @ApiProperty({ type: [String], example: ['Describe three distinct details.'] })
  completionCriteria!: string[];

  @ApiProperty({ type: [String], example: ['Stay in a public area.'] })
  safetyGuidance!: string[];
}

export class QuestAcceptanceDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439012' })
  id!: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  questId!: string;

  @ApiProperty({
    enum: ['accepted', 'submitted', 'retry', 'completed', 'expired'],
    example: 'accepted',
  })
  status!: QuestAcceptanceDocument['status'];

  @ApiProperty({ example: '2026-10-08T16:15:00.000Z' })
  acceptedAt!: string;

  @ApiProperty({ type: AcceptedQuestSnapshotDto })
  questSnapshot!: AcceptedQuestSnapshotDto;
}

export class ActiveQuestConflictDto {
  @ApiProperty({ example: 'active_quest_exists' })
  code!: string;

  @ApiProperty({ example: 'You already have a different active quest.' })
  message!: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439012' })
  activeAcceptanceId!: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439013' })
  activeQuestId!: string;
}
