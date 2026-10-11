import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { ClientSession, Connection, Model } from 'mongoose';
import { QuestAcceptance } from '../database/schemas/quest-acceptance.schema.js';
import { QuestCompletion } from '../database/schemas/quest-completion.schema.js';
import { SubmissionAttempt } from '../database/schemas/submission-attempt.schema.js';
import { User } from '../database/schemas/user.schema.js';
import { XpAward } from '../database/schemas/xp-award.schema.js';
import type {
  ClaimedVerificationJobDto,
  VerificationResultResponseDto,
} from './dto/verification-worker.dto.js';

const MIN_VERIFICATION_CONFIDENCE = 0.75;
const RARITY_XP: Record<string, number> = {
  common: 25,
  uncommon: 50,
  rare: 100,
};
const WORKER_FAILURE_CODES = new Set([
  'model_unavailable',
  'model_timeout',
  'invalid_output',
  'worker_error',
]);

interface ClaimedAttemptRecord {
  _id: Types.ObjectId;
  acceptanceId: Types.ObjectId;
  attemptNumber: number;
  evidenceText: string;
  evidenceDeleteAt: Date;
  status: SubmissionAttempt['status'];
  verificationClaimTokenHash: string;
  verificationClaimExpiresAt: Date;
  verificationClaimCount: number;
}

interface AcceptanceRecord {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  questId: Types.ObjectId;
  activeUserId?: Types.ObjectId;
  status: QuestAcceptance['status'];
  questSnapshot: QuestAcceptance['questSnapshot'];
}

interface Assessment {
  status: 'verified' | 'retry' | 'review';
  reason: string;
  confidence: number;
  failedCriteria: string[];
}

interface StoredVerification {
  reason: string | null;
  confidence: number | null;
  failedCriteria: string[];
}

interface CompletedAttemptRecord {
  _id: Types.ObjectId;
  status: SubmissionAttempt['status'];
  verification: StoredVerification;
  xpAwarded: number;
  lastVerificationClaimTokenHash?: string;
}

@Injectable()
export class VerificationWorkerService {
  constructor(
    private readonly configService: ConfigService,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(SubmissionAttempt.name)
    private readonly submissionAttemptModel: Model<SubmissionAttempt>,
    @InjectModel(QuestAcceptance.name)
    private readonly questAcceptanceModel: Model<QuestAcceptance>,
    @InjectModel(QuestCompletion.name)
    private readonly questCompletionModel: Model<QuestCompletion>,
    @InjectModel(XpAward.name)
    private readonly xpAwardModel: Model<XpAward>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async claimAttempt(now = new Date()): Promise<ClaimedVerificationJobDto | null> {
    await this.expireUnclaimedAttempts(now);
    const leaseSeconds =
      this.configService.get<number>('VERIFICATION_LEASE_SECONDS') ?? 120;
    const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1000);
    const claimToken = randomBytes(32).toString('hex');
    const verificationClaimTokenHash = hashToken(claimToken);
    const attempt = await this.submissionAttemptModel
      .findOneAndUpdate(
        {
          status: 'pending',
          evidenceDeleteAt: { $gt: now },
          $or: [
            { verificationClaimExpiresAt: { $exists: false } },
            { verificationClaimExpiresAt: { $lte: now } },
          ],
        },
        {
          $set: {
            verificationClaimTokenHash,
            verificationClaimExpiresAt: leaseExpiresAt,
            updatedAt: now,
          },
          $inc: { verificationClaimCount: 1 },
        },
        { new: true, sort: { createdAt: 1 } },
      )
      .lean<ClaimedAttemptRecord>()
      .exec();

    if (!attempt) {
      return null;
    }

    const acceptance = await this.questAcceptanceModel
      .findOne({
        _id: attempt.acceptanceId,
        status: 'submitted',
      })
      .select({ questSnapshot: 1 })
      .lean()
      .exec();

    if (!acceptance) {
      await this.releaseClaim(attempt, 'invalid_acceptance_state', now);
      return null;
    }

    return {
      attemptId: attempt._id.toString(),
      acceptanceId: attempt.acceptanceId.toString(),
      attemptNumber: attempt.attemptNumber,
      claimToken,
      leaseExpiresAt,
      questSnapshot: {
        title: acceptance.questSnapshot.title,
        description: acceptance.questSnapshot.description,
        region: acceptance.questSnapshot.region,
        durationMinutes: acceptance.questSnapshot.durationMinutes,
        difficulty: acceptance.questSnapshot.difficulty,
        rarity: acceptance.questSnapshot.rarity,
        xp: acceptance.questSnapshot.xp,
        proofInstructions: acceptance.questSnapshot.proofInstructions,
        completionCriteria: [
          ...acceptance.questSnapshot.completionCriteria,
        ],
        safetyGuidance: [...acceptance.questSnapshot.safetyGuidance],
      },
      completionCriteria: [...acceptance.questSnapshot.completionCriteria],
      evidenceText: attempt.evidenceText,
    };
  }

  async returnAssessment(
    attemptId: string,
    rawClaimToken: unknown,
    rawAssessment: unknown,
    now = new Date(),
  ): Promise<VerificationResultResponseDto> {
    const claimToken = validateClaimToken(rawClaimToken);
    const claimTokenHash = hashToken(claimToken);
    const attemptObjectId = new Types.ObjectId(attemptId);
    const ownedAttempt = await this.submissionAttemptModel
      .findById(attemptObjectId)
      .select({ acceptanceId: 1 })
      .lean()
      .exec();
    if (!ownedAttempt) {
      throw this.attemptNotFound();
    }

    const acceptance = await this.questAcceptanceModel
      .findById(ownedAttempt.acceptanceId)
      .select({ questSnapshot: 1 })
      .lean()
      .exec();
    if (!acceptance) {
      throw this.attemptNotFound();
    }

    let assessment: Assessment;
    try {
      assessment = validateAssessment(
        rawAssessment,
        acceptance.questSnapshot.completionCriteria,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        await this.releaseClaimById(
          attemptObjectId,
          claimTokenHash,
          'invalid_output',
          now,
        );
      }
      throw error;
    }

    if (
      assessment.status === 'review' ||
      assessment.confidence < MIN_VERIFICATION_CONFIDENCE
    ) {
      assessment = {
        ...assessment,
        status: 'retry',
        reason:
          assessment.confidence < MIN_VERIFICATION_CONFIDENCE
            ? truncateReason(
                `The result was uncertain, so no XP was awarded. Add more detail and try again. ${assessment.reason}`,
              )
            : assessment.reason,
      };
    }

    const expired = await this.expireClaimedAttempt(
      attemptObjectId,
      claimTokenHash,
      now,
    );
    if (expired) {
      throw new ConflictException({
        code: 'evidence_retention_expired',
        message: 'The evidence retention period has expired; this attempt cannot be verified.',
      });
    }

    try {
      return await this.applyAssessment(
        attemptObjectId,
        claimTokenHash,
        assessment,
        now,
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return this.applyAssessment(
          attemptObjectId,
          claimTokenHash,
          assessment,
          now,
        );
      }
      throw error;
    }
  }

  async reportWorkerFailure(
    attemptId: string,
    rawClaimToken: unknown,
    rawErrorCode: unknown,
    now = new Date(),
  ): Promise<{ retryable: true }> {
    const claimToken = validateClaimToken(rawClaimToken);
    if (
      typeof rawErrorCode !== 'string' ||
      !WORKER_FAILURE_CODES.has(rawErrorCode)
    ) {
      throw new BadRequestException({
        code: 'invalid_worker_error_code',
        message: 'The worker error code is not supported.',
      });
    }

    const attemptObjectId = new Types.ObjectId(attemptId);
    const released = await this.releaseClaimById(
      attemptObjectId,
      hashToken(claimToken),
      rawErrorCode,
      now,
    );
    if (!released) {
      const attemptExists = await this.submissionAttemptModel
        .exists({ _id: attemptObjectId })
        .exec();
      if (!attemptExists) {
        throw this.attemptNotFound();
      }
      throw this.claimConflict();
    }

    return { retryable: true };
  }

  private async applyAssessment(
    attemptId: Types.ObjectId,
    claimTokenHash: string,
    assessment: Assessment,
    now: Date,
  ): Promise<VerificationResultResponseDto> {
    const session = await this.connection.startSession();
    try {
      let response: VerificationResultResponseDto | undefined;
      await session.withTransaction(async () => {
        const attempt = await this.submissionAttemptModel
          .findById(attemptId)
          .session(session)
          .lean<ClaimedAttemptRecord & CompletedAttemptRecord>()
          .exec();
        if (!attempt) {
          throw this.attemptNotFound();
        }

        if (attempt.status !== 'pending') {
          if (
            attempt.lastVerificationClaimTokenHash === claimTokenHash &&
            attempt.status === assessment.status &&
            sameAssessment(attempt.verification, assessment)
          ) {
            response = this.toResultResponse(attempt);
            return;
          }
          throw this.claimConflict();
        }

        if (
          attempt.verificationClaimTokenHash !== claimTokenHash ||
          !attempt.verificationClaimExpiresAt ||
          attempt.verificationClaimExpiresAt <= now
        ) {
          throw this.claimConflict();
        }

        const acceptance = await this.questAcceptanceModel
          .findOne({
            _id: attempt.acceptanceId,
            status: 'submitted',
            activeUserId: { $exists: true },
          })
          .session(session)
          .lean<AcceptanceRecord>()
          .exec();
        if (!acceptance) {
          throw new ConflictException({
            code: 'acceptance_not_verifiable',
            message: 'The acceptance is not awaiting verification.',
          });
        }
        if (!acceptance.activeUserId?.equals(acceptance.userId)) {
          throw new ConflictException({
            code: 'acceptance_not_verifiable',
            message: 'The acceptance no longer belongs to an active quest.',
          });
        }

        let xpAwarded = 0;
        if (assessment.status === 'verified') {
          const expectedXp = RARITY_XP[acceptance.questSnapshot.rarity];
          if (
            expectedXp === undefined ||
            acceptance.questSnapshot.xp !== expectedXp ||
            acceptance.activeUserId.toString() !== acceptance.userId.toString()
          ) {
            throw new ConflictException({
              code: 'invalid_accepted_quest',
              message: 'The accepted quest snapshot does not match its fixed XP rule.',
            });
          }

          const completion = new this.questCompletionModel({
            userId: acceptance.userId,
            questId: acceptance.questId,
            acceptanceId: acceptance._id,
            winningAttemptId: attempt._id,
            completedAt: now,
          });
          await completion.save({ session });

          const existingAward = await this.xpAwardModel
            .findOne({
              userId: acceptance.userId,
              questId: acceptance.questId,
            })
            .session(session)
            .select({ _id: 1 })
            .lean()
            .exec();

          if (!existingAward) {
            const award = new this.xpAwardModel({
              userId: acceptance.userId,
              completionId: completion._id,
              questId: acceptance.questId,
              amount: expectedXp,
              awardedAt: now,
            });
            await award.save({ session });
            const userUpdate = await this.userModel.updateOne(
              { _id: acceptance.userId },
              { $inc: { xp: expectedXp }, $set: { updatedAt: now } },
              { session },
            );
            if (userUpdate.modifiedCount !== 1) {
              throw new ConflictException({
                code: 'guest_not_found',
                message: 'The guest account for this acceptance no longer exists.',
              });
            }
            xpAwarded = expectedXp;
          }

          const completionState = await this.questAcceptanceModel.updateOne(
            {
              _id: acceptance._id,
              userId: acceptance.userId,
              status: 'submitted',
              activeUserId: acceptance.userId,
            },
            {
              $set: { status: 'completed', updatedAt: now },
              $unset: { activeUserId: '' },
            },
            { session },
          );
          if (completionState.modifiedCount !== 1) {
            throw new ConflictException({
              code: 'acceptance_not_verifiable',
              message: 'The acceptance changed while verification was completing.',
            });
          }
        } else if (assessment.status === 'retry') {
          const retryState = await this.questAcceptanceModel.updateOne(
            {
              _id: acceptance._id,
              userId: acceptance.userId,
              status: 'submitted',
              activeUserId: acceptance.userId,
            },
            { $set: { status: 'retry', updatedAt: now } },
            { session },
          );
          if (retryState.modifiedCount !== 1) {
            throw new ConflictException({
              code: 'acceptance_not_verifiable',
              message: 'The acceptance changed while verification was completing.',
            });
          }
        }

        const attemptStatus =
          assessment.status === 'verified'
            ? 'verified'
            : assessment.status;
        const update = await this.submissionAttemptModel.updateOne(
          {
            _id: attempt._id,
            status: 'pending',
            verificationClaimTokenHash: claimTokenHash,
          },
          {
            $set: {
              status: attemptStatus,
              verification: {
                reason: assessment.reason,
                confidence: assessment.confidence,
                failedCriteria: assessment.failedCriteria,
                model: null,
                evaluatedAt: now,
              },
              xpAwarded,
              lastVerificationClaimTokenHash: claimTokenHash,
              updatedAt: now,
            },
            $unset: {
              verificationClaimTokenHash: '',
              verificationClaimExpiresAt: '',
            },
          },
          { session },
        );
        if (update.modifiedCount !== 1) {
          throw this.claimConflict();
        }

        response = {
          attemptId: attempt._id.toString(),
          status: attemptStatus,
          reason: assessment.reason,
          confidence: assessment.confidence,
          failedCriteria: assessment.failedCriteria,
          xpAwarded,
        };
      });

      if (!response) {
        throw new Error('Verification transaction produced no result.');
      }
      return response;
    } finally {
      await session.endSession();
    }
  }

  private async releaseClaim(
    attempt: ClaimedAttemptRecord,
    errorCode: string,
    now: Date,
  ): Promise<void> {
    await this.submissionAttemptModel.updateOne(
      {
        _id: attempt._id,
        verificationClaimTokenHash: attempt.verificationClaimTokenHash,
        status: 'pending',
      },
      {
        $set: { lastErrorCode: errorCode, updatedAt: now },
        $unset: {
          verificationClaimTokenHash: '',
          verificationClaimExpiresAt: '',
        },
      },
    );
  }

  private async expireUnclaimedAttempts(now: Date): Promise<void> {
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const expiredAttempts = await this.submissionAttemptModel
          .find({
            status: 'pending',
            evidenceDeleteAt: { $lte: now },
          })
          .select({ _id: 1, acceptanceId: 1 })
          .session(session)
          .lean<{ _id: Types.ObjectId; acceptanceId: Types.ObjectId }[]>()
          .exec();
        if (expiredAttempts.length === 0) {
          return;
        }

        const attemptIds = expiredAttempts.map((attempt) => attempt._id);
        const acceptanceIds = expiredAttempts.map(
          (attempt) => attempt.acceptanceId,
        );
        await this.submissionAttemptModel.updateMany(
          { _id: { $in: attemptIds }, status: 'pending' },
          {
            $set: {
              status: 'expired',
              lastErrorCode: 'evidence_retention_expired',
              updatedAt: now,
            },
            $unset: {
              verificationClaimTokenHash: '',
              verificationClaimExpiresAt: '',
            },
          },
          { session },
        );
        await this.questAcceptanceModel.updateMany(
          {
            _id: { $in: acceptanceIds },
            status: 'submitted',
          },
          {
            $set: { status: 'expired', updatedAt: now },
            $unset: { activeUserId: '' },
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
  }

  private async expireClaimedAttempt(
    attemptId: Types.ObjectId,
    claimTokenHash: string,
    now: Date,
  ): Promise<boolean> {
    const session = await this.connection.startSession();
    try {
      let expired = false;
      await session.withTransaction(async () => {
        const attempt = await this.submissionAttemptModel
          .findOne({
            _id: attemptId,
            status: 'pending',
            verificationClaimTokenHash: claimTokenHash,
            evidenceDeleteAt: { $lte: now },
          })
          .session(session)
          .lean<Pick<ClaimedAttemptRecord, '_id' | 'acceptanceId'>>()
          .exec();
        if (!attempt) {
          return;
        }
        await this.submissionAttemptModel.updateOne(
          {
            _id: attempt._id,
            status: 'pending',
            verificationClaimTokenHash: claimTokenHash,
          },
          {
            $set: {
              status: 'expired',
              lastErrorCode: 'evidence_retention_expired',
              updatedAt: now,
            },
            $unset: {
              verificationClaimTokenHash: '',
              verificationClaimExpiresAt: '',
            },
          },
          { session },
        );
        await this.questAcceptanceModel.updateOne(
          { _id: attempt.acceptanceId, status: 'submitted' },
          {
            $set: { status: 'expired', updatedAt: now },
            $unset: { activeUserId: '' },
          },
          { session },
        );
        expired = true;
      });
      return expired;
    } finally {
      await session.endSession();
    }
  }

  private async releaseClaimById(
    attemptId: Types.ObjectId,
    claimTokenHash: string,
    errorCode: string,
    now: Date,
  ): Promise<boolean> {
    const result = await this.submissionAttemptModel.updateOne(
      {
        _id: attemptId,
        status: 'pending',
        verificationClaimTokenHash: claimTokenHash,
      },
      {
        $set: { lastErrorCode: errorCode, updatedAt: now },
        $unset: {
          verificationClaimTokenHash: '',
          verificationClaimExpiresAt: '',
        },
      },
    );
    return result.modifiedCount === 1;
  }

  private toResultResponse(
    attempt: CompletedAttemptRecord,
  ): VerificationResultResponseDto {
    return {
      attemptId: attempt._id.toString(),
      status: attempt.status,
      reason: attempt.verification.reason ?? '',
      confidence: attempt.verification.confidence ?? 0,
      failedCriteria: [...attempt.verification.failedCriteria],
      xpAwarded: attempt.xpAwarded,
    };
  }

  private attemptNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'verification_attempt_not_found',
      message: 'The verification attempt was not found.',
    });
  }

  private claimConflict(): ConflictException {
    return new ConflictException({
      code: 'verification_claim_expired',
      message:
        'This verification claim is no longer active. Claim the attempt again before returning a result.',
    });
  }
}

function validateAssessment(
  value: unknown,
  allowedCriteria: string[],
): Assessment {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidAssessment();
  }

  const assessment = value as Record<string, unknown>;
  const expectedKeys = ['confidence', 'failedCriteria', 'reason', 'status'];
  if (
    Object.keys(assessment).length !== expectedKeys.length ||
    !expectedKeys.every((key) => Object.hasOwn(assessment, key))
  ) {
    throw invalidAssessment();
  }

  if (
    !['verified', 'retry', 'review'].includes(String(assessment.status)) ||
    typeof assessment.reason !== 'string' ||
    assessment.reason.trim().length === 0 ||
    assessment.reason.trim().length > 500 ||
    typeof assessment.confidence !== 'number' ||
    !Number.isFinite(assessment.confidence) ||
    assessment.confidence < 0 ||
    assessment.confidence > 1 ||
    !Array.isArray(assessment.failedCriteria) ||
    !assessment.failedCriteria.every(
      (criterion) =>
        typeof criterion === 'string' && allowedCriteria.includes(criterion),
    )
  ) {
    throw invalidAssessment();
  }

  const failedCriteria = assessment.failedCriteria as string[];
  if (
    new Set(failedCriteria).size !== failedCriteria.length ||
    (assessment.status === 'verified' && failedCriteria.length !== 0)
  ) {
    throw invalidAssessment();
  }

  return {
    status: assessment.status as Assessment['status'],
    reason: assessment.reason.trim(),
    confidence: assessment.confidence,
    failedCriteria: [...failedCriteria],
  };
}

function invalidAssessment(): BadRequestException {
  return new BadRequestException({
    code: 'invalid_assessment',
    message:
      'Assessment must contain a valid status, short reason, confidence from 0 to 1, and failed criteria from the accepted quest.',
  });
}

function validateClaimToken(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new BadRequestException({
      code: 'invalid_claim_token',
      message: 'A valid verification claim token is required.',
    });
  }
  return value;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function truncateReason(reason: string): string {
  return reason.length <= 500 ? reason : `${reason.slice(0, 497)}...`;
}

function sameAssessment(
  stored: StoredVerification,
  submitted: Assessment,
): boolean {
  return (
    stored.reason === submitted.reason &&
    stored.confidence === submitted.confidence &&
    JSON.stringify(stored.failedCriteria) ===
      JSON.stringify(submitted.failedCriteria)
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
