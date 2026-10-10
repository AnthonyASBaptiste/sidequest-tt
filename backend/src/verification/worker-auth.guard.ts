import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class VerificationWorkerAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configuredSecret = this.configService.get<string>(
      'VERIFICATION_WORKER_SECRET',
    );
    if (!configuredSecret) {
      throw new ServiceUnavailableException({
        code: 'verification_worker_not_configured',
        message: 'Verification worker authentication is not configured.',
      });
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    const prefix = 'Bearer ';
    if (!authorization?.startsWith(prefix)) {
      throw new UnauthorizedException('A valid worker bearer token is required.');
    }

    const providedSecret = Buffer.from(authorization.slice(prefix.length));
    const expectedSecret = Buffer.from(configuredSecret);
    if (
      providedSecret.length !== expectedSecret.length ||
      !timingSafeEqual(providedSecret, expectedSecret)
    ) {
      throw new UnauthorizedException('A valid worker bearer token is required.');
    }

    return true;
  }
}
