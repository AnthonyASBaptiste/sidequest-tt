import { ApiProperty } from '@nestjs/swagger';
import type { SubmissionAttempt } from '../../database/schemas/submission-attempt.schema.js';

export class CreateEvidenceSubmissionDto {
  @ApiProperty({
    example: 'I noticed three different styles of windows on the buildings.',
    minLength: 1,
    maxLength: 2000,
    required: false,
  })
  evidenceText?: string;

  @ApiProperty({
    example: 'data:image/jpeg;base64,...',
    description: 'Base64 data URL of the compressed photo proof (JPEG/PNG/WebP, max 1MB).',
    required: false,
  })
  evidencePhoto?: string;
}

export class EvidenceSubmissionDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439014' })
  id!: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439012' })
  acceptanceId!: string;

  @ApiProperty({ example: 1 })
  attemptNumber!: number;

  @ApiProperty({ enum: ['pending'], example: 'pending' })
  status!: SubmissionAttempt['status'];

  @ApiProperty({
    example: '2026-10-09T11:48:00.000Z',
    description: 'Time the evidence submission was created.',
  })
  submittedAt!: string;
}
