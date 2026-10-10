import { ApiProperty } from '@nestjs/swagger';
import { QuestAcceptanceDto } from './quest-acceptance.dto.js';
import { PlayerVerificationStatusDto } from '../../verification/dto/verification-worker.dto.js';

export class RecentQuestCompletionDto {
  @ApiProperty({ type: QuestAcceptanceDto })
  acceptance!: QuestAcceptanceDto;

  @ApiProperty({ type: PlayerVerificationStatusDto })
  submission!: PlayerVerificationStatusDto;

  @ApiProperty({ example: '2026-10-10T16:15:00.000Z' })
  completedAt!: string;
}

export class ActiveQuestResponseDto {
  @ApiProperty({
    type: QuestAcceptanceDto,
    nullable: true,
    description: 'The guest’s current active acceptance, if one exists.',
  })
  activeAcceptance!: QuestAcceptanceDto | null;

  @ApiProperty({
    type: PlayerVerificationStatusDto,
    nullable: true,
    description:
      'The latest submission status for the active acceptance, without evidence text.',
  })
  latestSubmission!: PlayerVerificationStatusDto | null;

  @ApiProperty({
    type: RecentQuestCompletionDto,
    nullable: true,
    description:
      'The guest’s most recent completed quest when no quest is active; contains no evidence text.',
  })
  recentCompletion!: RecentQuestCompletionDto | null;
}
