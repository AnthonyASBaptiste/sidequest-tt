import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import type { Types } from 'mongoose';

@Schema({ _id: false })
export class VerificationMetadata {
  @Prop({ type: String, default: null, maxlength: 500 })
  reason!: string | null;

  @Prop({ type: Number, min: 0, max: 1, default: null })
  confidence!: number | null;

  @Prop({ type: [String], default: [] })
  failedCriteria!: string[];

  @Prop({ type: String, default: null })
  model!: string | null;

  @Prop({ type: Date, default: null })
  evaluatedAt!: Date | null;
}

export const VerificationMetadataSchema =
  SchemaFactory.createForClass(VerificationMetadata);

@Schema({ collection: 'submissionAttempts', versionKey: false })
export class SubmissionAttempt {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: 'QuestAcceptance' })
  acceptanceId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1 })
  attemptNumber!: number;

  @Prop({ type: String, required: true, match: /^[a-f0-9]{64}$/ })
  idempotencyKeyHash!: string;

  @Prop({ type: String, required: true })
  evidenceText!: string;

  @Prop({
    type: String,
    required: true,
    enum: ['pending', 'verified', 'retry', 'review', 'expired'],
    default: 'pending',
  })
  status!: 'pending' | 'verified' | 'retry' | 'review' | 'expired';

  @Prop({ type: VerificationMetadataSchema, required: true, default: {} })
  verification!: VerificationMetadata;

  @Prop({ type: String, default: null })
  lastErrorCode!: string | null;

  @Prop({ type: Date, required: true })
  evidenceDeleteAt!: Date;

  @Prop({ type: String, match: /^[a-f0-9]{64}$/ })
  verificationClaimTokenHash?: string;

  @Prop({ type: Date })
  verificationClaimExpiresAt?: Date;

  @Prop({ type: String, match: /^[a-f0-9]{64}$/ })
  lastVerificationClaimTokenHash?: string;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  verificationClaimCount!: number;

  @Prop({ type: Number, required: true, min: 0, enum: [0, 25, 50, 100], default: 0 })
  xpAwarded!: number;

  @Prop({ type: Date, required: true, default: Date.now })
  createdAt!: Date;

  @Prop({ type: Date, required: true, default: Date.now })
  updatedAt!: Date;
}

export const SubmissionAttemptSchema =
  SchemaFactory.createForClass(SubmissionAttempt);
SubmissionAttemptSchema.index(
  { acceptanceId: 1, attemptNumber: 1 },
  { unique: true, name: 'submission_attempt_number_unique' },
);
SubmissionAttemptSchema.index(
  { idempotencyKeyHash: 1 },
  {
    unique: true,
    sparse: true,
    name: 'submission_attempt_idempotency_key_unique',
  },
);
SubmissionAttemptSchema.index(
  { status: 1, evidenceDeleteAt: 1 },
  { name: 'submission_attempts_status_evidence_delete_at' },
);
SubmissionAttemptSchema.index(
  { status: 1, verificationClaimExpiresAt: 1, createdAt: 1 },
  { name: 'submission_attempts_verification_claim_queue' },
);
