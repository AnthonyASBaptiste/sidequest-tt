import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  QuestBoardUnavailableDto,
  TodayQuestBoardDto,
} from './dto/todays-quest.dto.js';
import { ActiveQuestResponseDto } from './dto/active-quest.dto.js';
import {
  ActiveQuestConflictDto,
  QuestAcceptanceDto,
} from './dto/quest-acceptance.dto.js';
import { ParseObjectIdPipe } from './parse-object-id.pipe.js';
import { QuestsService } from './quests.service.js';
import { GuestSessionGuard } from '../sessions/guest-session.guard.js';
import type { GuestAuthenticatedRequest } from '../sessions/guest-session.guard.js';

@ApiTags('Quests')
@ApiCookieAuth('sidequest_guest')
@Controller('quests')
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  @Get('active')
  @UseGuards(GuestSessionGuard)
  @ApiOkResponse({
    description:
      'Returns the guest’s active acceptance and latest submission, or the most recent completed quest when no quest is active. Evidence text is never returned.',
    type: ActiveQuestResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid guest session cookie is required.',
  })
  getActiveQuest(
    @Req() request: GuestAuthenticatedRequest,
  ): Promise<ActiveQuestResponseDto> {
    return this.questsService.getActiveQuest(request.guestUserId);
  }

  @Post(':questId/accept')
  @UseGuards(GuestSessionGuard)
  @HttpCode(200)
  @ApiCreatedResponse({
    description: 'A new acceptance was created.',
    type: QuestAcceptanceDto,
  })
  @ApiOkResponse({
    description: 'The guest already has this quest active; its acceptance is returned.',
    type: QuestAcceptanceDto,
  })
  @ApiConflictResponse({
    description: 'A different quest is already active for this guest.',
    type: ActiveQuestConflictDto,
  })
  @ApiBadRequestResponse({
    description: 'The quest ID is not a valid MongoDB ObjectId.',
  })
  @ApiNotFoundResponse({
    description: 'The quest is not in the current published pool or is no longer available.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid guest session cookie is required.',
  })
  async acceptQuest(
    @Param('questId', ParseObjectIdPipe) questId: string,
    @Req() request: GuestAuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<QuestAcceptanceDto> {
    const result = await this.questsService.acceptQuest(
      request.guestUserId,
      questId,
    );
    response.status(result.created ? 201 : 200);
    return result.acceptance;
  }

  @Get('today')
  @UseGuards(GuestSessionGuard)
  @ApiOkResponse({
    description:
      'The published quest pool for today, or latest fallback, with this guest’s completion metadata.',
    type: TodayQuestBoardDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'No published quest pool is available.',
    type: QuestBoardUnavailableDto,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid guest session cookie is required.',
  })
  @Post('refresh')
  @UseGuards(GuestSessionGuard)
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Requests a fresh generation of today’s quest pool for the region.',
    type: TodayQuestBoardDto,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid guest session cookie is required.',
  })
  refreshTodaysQuestBoard(
    @Req() request: GuestAuthenticatedRequest,
    @Query('region') region?: string,
  ): Promise<TodayQuestBoardDto> {
    return this.questsService.refreshTodaysQuestBoard(request.guestUserId, region);
  }

  getTodaysQuestBoard(
    @Req() request: GuestAuthenticatedRequest,
    @Query('region') region?: string,
  ): Promise<TodayQuestBoardDto> {
    return this.questsService.getTodaysQuestBoard(request.guestUserId, region);
  }
}
