import { ApiProperty } from '@nestjs/swagger';
import type { AcceptedQuestSnapshot } from '../../database/schemas/quest-acceptance.schema.js';
import type { SubmissionAttempt } from '../../database/schemas/submission-attempt.schema.js';

export class ClaimedVerificationJobDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439014' })
  attemptId!: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439012' })
  acceptanceId!: string;

  @ApiProperty({ example: 1 })
  attemptNumber!: number;

  @ApiProperty({
    example: 'a 64-character, single-claim secret',
    description:
      'Keep this secret on the worker and send it only to this API when returning the result.',
  })
  claimToken!: string;

  @ApiProperty({ type: Date })
  leaseExpiresAt!: Date;

  @ApiProperty({ type: Object })
  questSnapshot!: AcceptedQuestSnapshot;

  @ApiProperty({ type: [String] })
  completionCriteria!: string[];

  @ApiProperty({
    example: 'I noticed three different architectural details.',
    description: 'Private evidence; use only for local Gemma assessment.',
  })
  evidenceText!: string;

  @ApiProperty({
    example: 'data:image/jpeg;base64,...',
    description: 'Private photo proof evidence for multimodal vision model assessment.',
    nullable: true,
    required: false,
  })
  evidencePhoto?: string | null;

  @ApiProperty({ enum: ['text', 'photo', 'both'], example: 'text', required: false })
  evidenceType?: 'text' | 'photo' | 'both';
}

export class ClaimVerificationResponseDto {
  @ApiProperty({ example: true })
  available!: boolean;

  @ApiProperty({ type: ClaimedVerificationJobDto, nullable: true })
  job!: ClaimedVerificationJobDto | null;
}

export class VerificationAssessmentDto {
  @ApiProperty({ enum: ['verified', 'retry', 'review'], example: 'verified' })
  status!: 'verified' | 'retry' | 'review';

  @ApiProperty({ example: 'The response addresses the quest criteria.', maxLength: 500 })
  reason!: string;

  @ApiProperty({ example: 0.87, minimum: 0, maximum: 1 })
  confidence!: number;

  @ApiProperty({ type: [String], example: [] })
  failedCriteria!: string[];
}

export class ReturnVerificationResultDto {
  @ApiProperty({ example: '64-character claim token' })
  claimToken!: string;

  @ApiProperty({ type: VerificationAssessmentDto })
  assessment!: VerificationAssessmentDto;
}

export class ReportVerificationFailureDto {
  @ApiProperty({ example: '64-character claim token' })
  claimToken!: string;

  @ApiProperty({
    enum: ['model_unavailable', 'model_timeout', 'invalid_output', 'worker_error'],
  })
  errorCode!: 'model_unavailable' | 'model_timeout' | 'invalid_output' | 'worker_error';
}

export class VerificationResultResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439014' })
  attemptId!: string;

  @ApiProperty({ enum: ['verified', 'retry', 'review'] })
  status!: SubmissionAttempt['status'];

  @ApiProperty({ example: 'The response addresses the quest criteria.' })
  reason!: string;

  @ApiProperty({ example: 0.87 })
  confidence!: number;

  @ApiProperty({ type: [String] })
  failedCriteria!: string[];

  @ApiProperty({ example: 25, description: 'Zero when XP was not awarded.' })
  xpAwarded!: number;
}

export class PlayerVerificationStatusDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439014' })
  attemptId!: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439012' })
  acceptanceId!: string;

  @ApiProperty({ example: 1 })
  attemptNumber!: number;

  @ApiProperty({
    enum: ['pending', 'verified', 'retry', 'review', 'expired'],
    example: 'retry',
  })
  status!: SubmissionAttempt['status'];

  @ApiProperty({ example: 'Please include more detail about the landmark.' , nullable: true })
  reason!: string | null;

  @ApiProperty({ example: 0.62, nullable: true })
  confidence!: number | null;

  @ApiProperty({ type: [String], example: ['Describe one detail you noticed.'] })
  failedCriteria!: string[];

  @ApiProperty({ example: 0, description: 'Zero when XP was not awarded.' })
  xpAwarded!: number;

  @ApiProperty({ example: '2026-10-09T11:48:00.000Z' })
  submittedAt!: string;
}

export class VerificationFailureResponseDto {
  @ApiProperty({ example: true })
  retryable!: boolean;
}
