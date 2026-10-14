import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { GuestAuthenticatedRequest } from '../sessions/guest-session.guard.js';
import { GuestSessionGuard } from '../sessions/guest-session.guard.js';
import { CreateEvidenceSubmissionDto, EvidenceSubmissionDto } from './dto/evidence-submission.dto.js';
import { ParseObjectIdPipe } from './parse-object-id.pipe.js';
import { SubmissionsService } from './submissions.service.js';
import { PlayerVerificationStatusDto } from '../verification/dto/verification-worker.dto.js';

@ApiTags('Submissions')
@ApiCookieAuth('sidequest_guest')
@Controller('acceptances')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get(':acceptanceId/submissions/:attemptId')
  @UseGuards(GuestSessionGuard)
  @ApiOkResponse({
    description:
      'Returns this guest’s submission status and feedback without the evidence text.',
    type: PlayerVerificationStatusDto,
  })
  @ApiNotFoundResponse({
    description: 'The acceptance or submission does not exist for this guest.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid guest session cookie is required.',
  })
  getSubmissionStatus(
    @Param('acceptanceId', ParseObjectIdPipe) acceptanceId: string,
    @Param('attemptId', ParseObjectIdPipe) attemptId: string,
    @Req() request: GuestAuthenticatedRequest,
  ): Promise<PlayerVerificationStatusDto> {
    return this.submissionsService.getSubmissionStatus(
      request.guestUserId,
      acceptanceId,
      attemptId,
    );
  }

  @Post(':acceptanceId/submissions')
  @UseGuards(GuestSessionGuard)
  @HttpCode(200)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'A unique key for this evidence submission; reuse it for request retries.',
    schema: { type: 'string', minLength: 1, maxLength: 128 },
  })
  @ApiCreatedResponse({
    description: 'Evidence was stored as a new pending submission attempt.',
    type: EvidenceSubmissionDto,
  })
  @ApiOkResponse({
    description: 'The existing attempt is returned for an idempotent retry.',
    type: EvidenceSubmissionDto,
  })
  @ApiBadRequestResponse({
    description: 'The acceptance ID, evidence text, or Idempotency-Key is invalid.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid guest session cookie is required.',
  })
  @ApiNotFoundResponse({
    description: 'The acceptance does not exist for this guest.',
  })
  @ApiConflictResponse({
    description:
      'The acceptance is not ready for evidence, or the Idempotency-Key was used for a different submission.',
  })
  async submitEvidence(
    @Param('acceptanceId', ParseObjectIdPipe) acceptanceId: string,
    @Body() body: CreateEvidenceSubmissionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: GuestAuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<EvidenceSubmissionDto> {
    const result = await this.submissionsService.submitEvidence(
      request.guestUserId,
      acceptanceId,
      body?.evidenceText,
      body?.evidencePhoto,
      idempotencyKey,
    );
    response.status(result.created ? 201 : 200);
    return result.attempt;
  }
}
