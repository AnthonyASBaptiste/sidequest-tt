import { ApiProperty } from '@nestjs/swagger';
import { QuestAcceptanceDto } from './quest-acceptance.dto.js';
import { PlayerVerificationStatusDto } from '../../verification/dto/verification-worker.dto.js';

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
}
