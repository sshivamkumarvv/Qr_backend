import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import * as bcrypt from 'bcrypt';

import { UserSession } from './entities/user-session.entity';

@Injectable()
export class UserSessionsService {
  constructor(
    @InjectRepository(UserSession)
    private readonly userSessionsRepository: Repository<UserSession>,
  ) {}

  async createSession(data: {
    userId: string;
    refreshToken: string;
    expiresAt: Date;
    deviceId: string;
    deviceName?: string;
    platform?: string;
    appVersion?: string;
    pushToken?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<UserSession> {
    const refreshTokenHash = data.refreshToken
      ? await bcrypt.hash(data.refreshToken, 10)
      : '';

    const session = this.userSessionsRepository.create({
      userId: data.userId,
      refreshTokenHash,
      expiresAt: data.expiresAt,
      deviceId: data.deviceId,
      deviceName: data.deviceName ?? null,
      platform: data.platform ?? null,
      appVersion: data.appVersion ?? null,
      pushToken: data.pushToken ?? null,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      lastUsedAt: new Date(),
    });

    return this.userSessionsRepository.save(session);
  }

  async findById(sessionId: string): Promise<UserSession> {
    const session = await this.userSessionsRepository.findOne({
      where: {
        id: sessionId,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    return session;
  }

  async findActiveSession(
    sessionId: string,
  ): Promise<UserSession> {
    const session = await this.findById(sessionId);

    if (session.isRevoked) {
      throw new UnauthorizedException(
        'Session has been revoked.',
      );
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Session has expired.',
      );
    }

    return session;
  }

async getUserSessions(
  userId: string,
): Promise<UserSession[]> {
  return this.userSessionsRepository.find({
    where: {
      userId,
      isRevoked: false,
    },
    order: {
      lastUsedAt: 'DESC',
    },
  });
}

  async verifyRefreshToken(
    sessionId: string,
    refreshToken: string,
  ): Promise<UserSession> {
    const session =
      await this.findActiveSession(sessionId);

    const matched = await bcrypt.compare(
      refreshToken,
      session.refreshTokenHash,
    );

    if (!matched) {
      throw new UnauthorizedException(
        'Invalid refresh token.',
      );
    }

    return session;
  }

  async updateRefreshToken(
    sessionId: string,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<UserSession> {
    const session =
      await this.findActiveSession(sessionId);

    session.refreshTokenHash =
      await bcrypt.hash(refreshToken, 10);

    session.expiresAt = expiresAt;

    session.lastUsedAt = new Date();

    return this.userSessionsRepository.save(
      session,
    );
  }

async touchSession(
  sessionId: string,
): Promise<void> {
  await this.userSessionsRepository.update(
    {
      id: sessionId,
    },
    {
      lastUsedAt: new Date(),
    },
  );
}

  async revokeSession(
    sessionId: string,
  ): Promise<UserSession> {
    const session = await this.findById(sessionId);

    session.isRevoked = true;

    session.refreshTokenHash = '';

    session.lastUsedAt = new Date();

    return this.userSessionsRepository.save(
      session,
    );
  }

  async revokeAllSessions(
    userId: string,
  ): Promise<void> {
    await this.userSessionsRepository.update(
      {
        userId,
        isRevoked: false,
      },
      {
        isRevoked: true,
        refreshTokenHash: '',
      },
    );
  }

  async deleteExpiredSessions(): Promise<void> {
    await this.userSessionsRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt < NOW()')
      .execute();
  }

  
}