import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { Connection, Model } from 'mongoose';
import { QuestAcceptance } from '../database/schemas/quest-acceptance.schema.js';
import { SubmissionAttempt } from '../database/schemas/submission-attempt.schema.js';
import {
  EvidenceSubmissionDto,
} from './dto/evidence-submission.dto.js';
import { PlayerVerificationStatusDto } from '../verification/dto/verification-worker.dto.js';

const EVIDENCE_MAX_CHARACTERS = 2000;
const EVIDENCE_RETENTION_DAYS = 30;

interface AttemptRecord {
  _id: Types.ObjectId;
  acceptanceId: Types.ObjectId;
  attemptNumber: number;
  status: SubmissionAttempt['status'];
  createdAt: Date;
  evidenceText?: string;
}

interface SubmissionResult {
  attempt: EvidenceSubmissionDto;
  created: boolean;
}

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(QuestAcceptance.name)
    private readonly questAcceptanceModel: Model<QuestAcceptance>,
    @InjectModel(SubmissionAttempt.name)
    private readonly submissionAttemptModel: Model<SubmissionAttempt>,
  ) {}

  async submitEvidence(
    userId: Types.ObjectId,
    acceptanceId: string,
    rawEvidenceText: unknown,
    rawEvidencePhoto: unknown,
    rawIdempotencyKey: string | undefined,
    now = new Date(),
  ): Promise<SubmissionResult> {
    const acceptanceObjectId = new Types.ObjectId(acceptanceId);
    const ownedAcceptance = await this.questAcceptanceModel
      .exists({ _id: acceptanceObjectId, userId })
      .exec();
    if (!ownedAcceptance) {
      throw this.acceptanceNotFound();
    }

    const { evidenceText, evidencePhoto, evidenceType } = validateEvidence(
      rawEvidenceText,
      rawEvidencePhoto,
    );
    const idempotencyKeyHash = hashIdempotencyKey(
      validateIdempotencyKey(rawIdempotencyKey),
    );
    // If photo is present, retain for 1 day (24h) to save storage. If text only, 30 days.
    const retentionDays = evidencePhoto ? 1 : EVIDENCE_RETENTION_DAYS;
    const evidenceDeleteAt = new Date(
      now.getTime() + retentionDays * 24 * 60 * 60 * 1000,
    );
    const session = await this.connection.startSession();

    try {
      let result: SubmissionResult | undefined;
      await session.withTransaction(async () => {
        const acceptance = await this.questAcceptanceModel
          .findOne({ _id: acceptanceObjectId, userId })
          .session(session)
          .lean()
          .exec();

        if (!acceptance) {
          throw this.acceptanceNotFound();
        }

        const existingAttempt = await this.submissionAttemptModel
          .findOne({ idempotencyKeyHash })
          .session(session)
          .lean<AttemptRecord>()
          .exec();

        if (existingAttempt) {
          if (
            !existingAttempt.acceptanceId.equals(acceptanceObjectId) ||
            (existingAttempt.evidenceText !== undefined &&
              existingAttempt.evidenceText !== evidenceText)
          ) {
            throw this.idempotencyKeyConflict();
          }
          result = {
            attempt: this.toDto(existingAttempt),
            created: false,
          };
          return;
        }

        const previousAttempt = await this.submissionAttemptModel
          .findOne({ acceptanceId: acceptanceObjectId })
          .sort({ attemptNumber: -1 })
          .select({ attemptNumber: 1, status: 1 })
          .session(session)
          .lean<{ attemptNumber: number; status: SubmissionAttempt['status'] }>()
          .exec();
        const retryingExistingReview =
          acceptance.status === 'submitted' &&
          previousAttempt?.status === 'review';

        if (
          !['accepted', 'retry'].includes(acceptance.status) &&
          !retryingExistingReview
        ) {
          throw new ConflictException({
            code: 'acceptance_not_submittable',
            message: 'Evidence can be submitted only for an accepted or retrying quest.',
          });
        }

        const attemptNumber = (previousAttempt?.attemptNumber ?? 0) + 1;

        const attempt = new this.submissionAttemptModel({
          acceptanceId: acceptanceObjectId,
          attemptNumber,
          idempotencyKeyHash,
          evidenceText,
          evidencePhoto,
          evidenceType,
          status: 'pending',
          verification: {},
          lastErrorCode: null,
          evidenceDeleteAt,
          createdAt: now,
          updatedAt: now,
        });
        await attempt.save({ session });

        const stateChange = await this.questAcceptanceModel.updateOne(
          {
            _id: acceptanceObjectId,
            userId,
            activeUserId: userId,
            status: retryingExistingReview
              ? 'submitted'
              : { $in: ['accepted', 'retry'] },
          },
          {
            $set: {
              status: 'submitted',
              updatedAt: now,
            },
          },
          { session },
        );

        if (stateChange.modifiedCount !== 1) {
          throw new ConflictException({
            code: 'acceptance_not_submittable',
            message:
              'This acceptance changed while the evidence was being submitted. Retry with the same Idempotency-Key.',
          });
        }

        result = {
          attempt: this.toDto({
            _id: attempt._id,
            acceptanceId: attempt.acceptanceId,
            attemptNumber: attempt.attemptNumber,
            status: attempt.status,
            createdAt: attempt.createdAt,
          }),
          created: true,
        };
      });

      if (!result) {
        throw new Error('Evidence submission transaction produced no result.');
      }
      return result;
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      return this.resolveDuplicateKey(
        userId,
        acceptanceObjectId,
        idempotencyKeyHash,
        evidenceText,
      );
    } finally {
      await session.endSession();
    }
  }

  async getSubmissionStatus(
    userId: Types.ObjectId,
    acceptanceId: string,
    attemptId: string,
  ): Promise<PlayerVerificationStatusDto> {
    const acceptanceObjectId = new Types.ObjectId(acceptanceId);
    const attemptObjectId = new Types.ObjectId(attemptId);
    const acceptance = await this.questAcceptanceModel
      .exists({ _id: acceptanceObjectId, userId })
      .exec();
    if (!acceptance) {
      throw this.acceptanceNotFound();
    }

    const attempt = await this.submissionAttemptModel
      .findOne({ _id: attemptObjectId, acceptanceId: acceptanceObjectId })
      .select({
        _id: 1,
        acceptanceId: 1,
        attemptNumber: 1,
        status: 1,
        verification: 1,
        xpAwarded: 1,
        createdAt: 1,
      })
      .lean()
      .exec();
    if (!attempt) {
      throw this.acceptanceNotFound();
    }

    return {
      attemptId: attempt._id.toString(),
      acceptanceId: attempt.acceptanceId.toString(),
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      reason: attempt.verification.reason,
      confidence: attempt.verification.confidence,
      failedCriteria: [...attempt.verification.failedCriteria],
      xpAwarded: attempt.xpAwarded,
      submittedAt: attempt.createdAt.toISOString(),
    };
  }

  private async resolveDuplicateKey(
    userId: Types.ObjectId,
    acceptanceId: Types.ObjectId,
    idempotencyKeyHash: string,
    evidenceText: string,
  ): Promise<SubmissionResult> {
    const ownedAcceptance = await this.questAcceptanceModel
      .exists({ _id: acceptanceId, userId })
      .exec();
    if (!ownedAcceptance) {
      throw this.acceptanceNotFound();
    }

    const attempt = await this.submissionAttemptModel
      .findOne({ idempotencyKeyHash })
      .lean<AttemptRecord>()
      .exec();
    if (attempt) {
      if (
        !attempt.acceptanceId.equals(acceptanceId) ||
        (attempt.evidenceText !== undefined &&
          attempt.evidenceText !== evidenceText)
      ) {
        throw this.idempotencyKeyConflict();
      }
      return {
        attempt: this.toDto(attempt),
        created: false,
      };
    }

    throw new ConflictException({
      code: 'submission_race',
      message:
        'Another submission request changed this acceptance. Retry with the same Idempotency-Key.',
    });
  }

  private toDto(attempt: AttemptRecord): EvidenceSubmissionDto {
    return {
      id: attempt._id.toString(),
      acceptanceId: attempt.acceptanceId.toString(),
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      submittedAt: attempt.createdAt.toISOString(),
    };
  }

  private acceptanceNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'acceptance_not_found',
      message: 'The quest acceptance was not found.',
    });
  }

  private idempotencyKeyConflict(): ConflictException {
    return new ConflictException({
      code: 'idempotency_key_reused',
      message: 'This Idempotency-Key has already been used for another submission.',
    });
  }
}

const MAX_PHOTO_BASE64_LENGTH = 1_500_000; // ~1MB binary payload

function validateEvidence(
  rawText: unknown,
  rawPhoto: unknown,
): {
  evidenceText: string;
  evidencePhoto: string | null;
  evidenceType: 'text' | 'photo' | 'both';
} {
  const hasText = typeof rawText === 'string' && rawText.trim().length > 0;
  const hasPhoto = typeof rawPhoto === 'string' && rawPhoto.trim().length > 0;

  if (!hasText && !hasPhoto) {
    throw new BadRequestException({
      code: 'missing_evidence',
      message: 'You must provide either photo proof or a written reflection.',
    });
  }

  let evidenceText = '';
  if (hasText) {
    evidenceText = (rawText as string).trim();
    if (Array.from(evidenceText).length > EVIDENCE_MAX_CHARACTERS) {
      throw new BadRequestException({
        code: 'invalid_evidence_text',
        message: 'evidenceText must contain 1 to 2,000 characters after trimming.',
      });
    }
    // Sanitize control characters (except newline, tab, carriage return)
    evidenceText = evidenceText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  let evidencePhoto: string | null = null;
  if (hasPhoto) {
    const photoStr = (rawPhoto as string).trim();
    if (photoStr.length > MAX_PHOTO_BASE64_LENGTH) {
      throw new BadRequestException({
        code: 'photo_too_large',
        message: 'Photo proof exceeds the maximum allowed size (1MB). Please use a compressed image.',
      });
    }

    const match = photoStr.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      throw new BadRequestException({
        code: 'invalid_photo_format',
        message: 'Photo proof must be a valid base64 data URL of type JPEG, PNG, or WebP.',
      });
    }

    const base64Data = match[2];
    const headerBuffer = Buffer.from(base64Data.slice(0, 32), 'base64');
    const isJpeg = headerBuffer[0] === 0xff && headerBuffer[1] === 0xd8 && headerBuffer[2] === 0xff;
    const isPng = headerBuffer[0] === 0x89 && headerBuffer[1] === 0x50 && headerBuffer[2] === 0x4e && headerBuffer[3] === 0x47;
    const isWebp = headerBuffer.subarray(0, 4).toString('ascii') === 'RIFF' && headerBuffer.subarray(8, 12).toString('ascii') === 'WEBP';

    if (!isJpeg && !isPng && !isWebp) {
      throw new BadRequestException({
        code: 'invalid_image_payload',
        message: 'The submitted image file header is invalid or corrupt. Only JPEG, PNG, and WebP images are permitted.',
      });
    }

    evidencePhoto = photoStr;
  }

  const evidenceType: 'text' | 'photo' | 'both' =
    hasText && hasPhoto ? 'both' : hasPhoto ? 'photo' : 'text';

  return { evidenceText, evidencePhoto, evidenceType };
}

function validateIdempotencyKey(value: string | undefined): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 128 ||
    !/^[\x21-\x7e]+$/.test(value)
  ) {
    throw new BadRequestException({
      code: 'invalid_idempotency_key',
      message: 'Idempotency-Key must contain 1 to 128 visible ASCII characters.',
    });
  }

  return value;
}

function hashIdempotencyKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}
