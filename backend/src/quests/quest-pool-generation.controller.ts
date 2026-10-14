import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  PublishGeneratedQuestPoolDto,
  PublishGeneratedQuestPoolResponseDto,
  QuestPoolTemplatesResponseDto,
} from './dto/quest-pool-generation.dto.js';
import { QuestPoolGenerationService } from './quest-pool-generation.service.js';
import { VerificationWorkerAuthGuard } from '../verification/worker-auth.guard.js';

@ApiTags('Quest pool generation worker')
@ApiBearerAuth()
@UseGuards(VerificationWorkerAuthGuard)
@Controller('internal/quest-pools')
export class QuestPoolGenerationController {
  constructor(private readonly generationService: QuestPoolGenerationService) {}

  @Get('templates')
  @ApiOkResponse({
    description:
      'Returns active, human-reviewed templates for the specified or current Trinidad/Tobago date.',
    type: QuestPoolTemplatesResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid worker credentials.' })
  @ApiServiceUnavailableResponse({
    description: 'Worker authentication is not configured.',
  })
  getTemplates(
    @Query('region') region?: string,
  ): Promise<QuestPoolTemplatesResponseDto> {
    return this.generationService.getTemplates(region);
  }

  @Post('publish')
  @HttpCode(201)
  @ApiCreatedResponse({
    description:
      'Validates a complete generated pool and publishes it atomically. A pool already published for this date is never replaced.',
    type: PublishGeneratedQuestPoolResponseDto,
  })
  @ApiConflictResponse({
    description:
      'A pool already exists for the date, or the request uses a date other than today in Trinidad.',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid worker credentials.' })
  @ApiServiceUnavailableResponse({
    description: 'Worker authentication is not configured.',
  })
  publishPool(
    @Body() body: PublishGeneratedQuestPoolDto,
  ): Promise<PublishGeneratedQuestPoolResponseDto> {
    return this.generationService.publishPool(body);
  }
}
