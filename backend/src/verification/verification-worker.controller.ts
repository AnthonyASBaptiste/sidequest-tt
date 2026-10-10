import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ClaimVerificationResponseDto,
  ReportVerificationFailureDto,
  ReturnVerificationResultDto,
  VerificationFailureResponseDto,
  VerificationResultResponseDto,
} from './dto/verification-worker.dto.js';
import { ParseObjectIdPipe } from '../quests/parse-object-id.pipe.js';
import { VerificationWorkerAuthGuard } from './worker-auth.guard.js';
import { VerificationWorkerService } from './verification-worker.service.js';

@ApiTags('Verification worker')
@ApiBearerAuth()
@UseGuards(VerificationWorkerAuthGuard)
@Controller('internal/verification')
export class VerificationWorkerController {
  constructor(
    private readonly verificationWorkerService: VerificationWorkerService,
  ) {}

  @Post('claim')
  @HttpCode(200)
  @ApiOkResponse({
    description:
      'Claims one pending attempt for a lease, or returns available=false when the queue is empty.',
    type: ClaimVerificationResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid worker credentials.' })
  @ApiServiceUnavailableResponse({
    description: 'Verification worker authentication is not configured.',
  })
  async claim(): Promise<ClaimVerificationResponseDto> {
    const job = await this.verificationWorkerService.claimAttempt();
    return { available: job !== null, job };
  }

  @Post('attempts/:attemptId/result')
  @HttpCode(200)
  @ApiOkResponse({
    description:
      'Stores the validated assessment and atomically completes the quest and awards XP when appropriate.',
    type: VerificationResultResponseDto,
  })
  @ApiBadRequestResponse({ description: 'The assessment payload is invalid.' })
  @ApiConflictResponse({
    description: 'The claim expired, was replaced, or the attempt cannot be verified.',
  })
  @ApiNotFoundResponse({ description: 'The verification attempt was not found.' })
  @ApiUnauthorizedResponse({ description: 'Invalid worker credentials.' })
  async returnResult(
    @Param('attemptId', ParseObjectIdPipe) attemptId: string,
    @Body() body: ReturnVerificationResultDto,
  ): Promise<VerificationResultResponseDto> {
    return this.verificationWorkerService.returnAssessment(
      attemptId,
      body?.claimToken,
      body?.assessment,
    );
  }

  @Post('attempts/:attemptId/failure')
  @HttpCode(200)
  @ApiOkResponse({
    description:
      'Releases a claimed attempt for retry after a worker/model failure.',
    type: VerificationFailureResponseDto,
  })
  @ApiBadRequestResponse({ description: 'The claim token or error code is invalid.' })
  @ApiConflictResponse({ description: 'The verification claim is no longer active.' })
  @ApiNotFoundResponse({ description: 'The verification attempt was not found.' })
  @ApiUnauthorizedResponse({ description: 'Invalid worker credentials.' })
  reportFailure(
    @Param('attemptId', ParseObjectIdPipe) attemptId: string,
    @Body() body: ReportVerificationFailureDto,
  ): Promise<{ retryable: true }> {
    return this.verificationWorkerService.reportWorkerFailure(
      attemptId,
      body?.claimToken,
      body?.errorCode,
    );
  }
}
