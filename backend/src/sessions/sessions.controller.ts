import {
  Controller,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  GUEST_SESSION_COOKIE,
  GUEST_SESSION_MAX_AGE_MS,
} from './guest-session.constants.js';
import { GuestSessionDto } from './dto/guest-session.dto.js';
import { GuestSessionService } from './guest-session.service.js';

@ApiTags('Session')
@Controller('session')
export class SessionsController {
  constructor(private readonly guestSessionService: GuestSessionService) {}

  @Post('guest')
  @ApiOperation({
    summary: 'Create or return the browser’s anonymous guest session.',
  })
  @ApiCreatedResponse({
    description:
      'Returns the existing guest for a valid cookie or creates a guest and sets the protected session cookie.',
    type: GuestSessionDto,
  })
  async createGuestSession(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<GuestSessionDto> {
    const session = await this.guestSessionService.getOrCreateGuest(
      request.headers.cookie,
    );

    if (session.cookieToken) {
      const isProduction = process.env.NODE_ENV === 'production';
      response.cookie(GUEST_SESSION_COOKIE, session.cookieToken, {
        httpOnly: true,
        sameSite: isProduction ? 'none' : 'lax',
        secure: isProduction,
        path: '/',
        maxAge: GUEST_SESSION_MAX_AGE_MS,
      });
    }

    return {
      guest: {
        id: session.guest.id.toString(),
        region: session.guest.region,
        xp: session.guest.xp,
      },
    };
  }
}
