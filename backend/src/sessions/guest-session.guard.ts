import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Types } from 'mongoose';
import { GuestSessionService } from './guest-session.service.js';

export interface GuestAuthenticatedRequest extends Request {
  guestUserId: Types.ObjectId;
}

@Injectable()
export class GuestSessionGuard implements CanActivate {
  constructor(private readonly guestSessionService: GuestSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<GuestAuthenticatedRequest>();
    const guest = await this.guestSessionService.getGuestFromCookieHeader(
      request.headers.cookie,
    );

    if (!guest) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'A valid guest session is required.',
        error: 'Unauthorized',
      });
    }

    request.guestUserId = guest.id;
    return true;
  }
}
