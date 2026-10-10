import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../database/schemas/user.schema.js';
import { GuestSessionGuard } from './guest-session.guard.js';
import { GuestSessionService } from './guest-session.service.js';
import { SessionsController } from './sessions.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [SessionsController],
  providers: [GuestSessionGuard, GuestSessionService],
  exports: [GuestSessionGuard, GuestSessionService],
})
export class SessionsModule {}
