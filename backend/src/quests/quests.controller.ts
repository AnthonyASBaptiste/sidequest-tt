import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
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
      'Returns the guest’s active acceptance and its latest submission status, if any.',
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
      'The published Trinidad quest pool for today, or latest fallback, with this guest’s completion metadata.',
    type: TodayQuestBoardDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'No published Trinidad quest pool is available.',
    type: QuestBoardUnavailableDto,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid guest session cookie is required.',
  })
  getTodaysQuestBoard(
    @Req() request: GuestAuthenticatedRequest,
  ): Promise<TodayQuestBoardDto> {
    return this.questsService.getTodaysQuestBoard(request.guestUserId);
  }
}
