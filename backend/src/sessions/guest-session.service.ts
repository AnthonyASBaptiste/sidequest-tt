import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../database/schemas/user.schema.js';
import { GUEST_SESSION_MAX_AGE_MS } from './guest-session.constants.js';

export interface GuestIdentity {
  id: Types.ObjectId;
  name?: string;
  region: 'Trinidad';
  xp: number;
}

export interface CreatedGuestSession {
  guest: GuestIdentity;
  cookieToken?: string;
}

@Injectable()
export class GuestSessionService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  async getGuestFromCookieHeader(
    cookieHeader: string | undefined,
    now = new Date(),
  ): Promise<GuestIdentity | null> {
    const token = readGuestCookie(cookieHeader);
    if (!token) {
      return null;
    }

    const guest = await this.userModel
      .findOne({
        'auth.provider': 'guest',
        'auth.subject': hashGuestToken(token),
        createdAt: { $gt: new Date(now.getTime() - GUEST_SESSION_MAX_AGE_MS) },
      })
      .select({ _id: 1, name: 1, region: 1, xp: 1 })
      .lean()
      .exec();

    if (!guest) {
      return null;
    }

    return {
      id: guest._id,
      name: guest.name,
      region: guest.region,
      xp: guest.xp,
    };
  }

  async getOrCreateGuest(
    cookieHeader: string | undefined,
  ): Promise<CreatedGuestSession> {
    const existingGuest = await this.getGuestFromCookieHeader(cookieHeader);
    if (existingGuest) {
      return { guest: existingGuest };
    }

    const cookieToken = randomBytes(32).toString('hex');
    const user = await this.userModel.create({
      auth: {
        provider: 'guest',
        subject: hashGuestToken(cookieToken),
      },
      region: 'Trinidad',
      preferences: {},
      xp: 0,
    });

    return {
      guest: {
        id: user._id,
        region: user.region,
        xp: user.xp,
      },
      cookieToken,
    };
  }
}

function hashGuestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function readGuestCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }

  let token: string | null = null;
  for (const part of cookieHeader.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const name = part.slice(0, separatorIndex).trim();
    if (name !== 'sidequest_guest') {
      continue;
    }

    if (token !== null) {
      return null;
    }

    const value = part.slice(separatorIndex + 1).trim();
    if (!/^[a-f0-9]{64}$/.test(value)) {
      return null;
    }
    token = value;
  }

  return token;
}
