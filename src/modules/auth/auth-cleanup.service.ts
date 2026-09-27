import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { OtpService } from './otp.service';
import { UserSessionsService } from '../user-sessions/user-sessions.service';

@Injectable()
export class AuthCleanupService {
  private readonly logger = new Logger(
    AuthCleanupService.name,
  );

  constructor(
    private readonly otpService: OtpService,

    private readonly userSessionsService: UserSessionsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanup() {
    this.logger.log(
      'Starting authentication cleanup...',
    );

    await this.otpService.deleteExpiredOtps();

    await this.userSessionsService.deleteExpiredSessions();

    this.logger.log(
      'Authentication cleanup completed.',
    );
  }
}