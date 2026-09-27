import { BadRequestException, Injectable,UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { OtpService } from './otp.service';

import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { UserSessionsService } from '../user-sessions/user-sessions.service';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GuestLoginDto } from './dto/guest-login.dto';
import { UserSession } from '../user-sessions/entities/user-session.entity';



@Injectable()
export class AuthService {
constructor(
  @InjectRepository(User)
  private readonly usersRepository: Repository<User>,

  private readonly jwtService: JwtService,

  private readonly otpService: OtpService,

  private readonly userSessionsService: UserSessionsService,
  private readonly configService: ConfigService,
) {}

private async generateAccessToken(
  user: User,
  sessionId: string,
): Promise<string> {
  return this.jwtService.signAsync(
    {
      sub: user.id,
      sid: sessionId,
      role: user.role,
      phone: user.phone,
    },
    {
      secret: this.configService.getOrThrow<string>(
        'jwt.access.secret',
      ),

      expiresIn: this.configService.getOrThrow<string>(
        'jwt.access.expiresIn',
      ) as any,
    },
  );
}

private async generateRefreshToken(
  user: User,
  sessionId: string,
): Promise<string> {
  return this.jwtService.signAsync(
    {
      sub: user.id,
      sid: sessionId,
      type: 'refresh',
    },
    {
      secret: this.configService.getOrThrow<string>(
        'jwt.refresh.secret',
      ),

      expiresIn: this.configService.getOrThrow<string>(
        'jwt.refresh.expiresIn',
      ) as any,
    },
  );
}

private async generateTokens(
  user: User,
  sessionId: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const accessToken = await this.generateAccessToken(
    user,
    sessionId,
  );

  const refreshToken = await this.generateRefreshToken(
    user,
    sessionId,
  );

  return {
    accessToken,
    refreshToken,
  };
}

private getRefreshTokenExpiry(): Date {
  const expiry = new Date();

  // Keep this in sync with JWT_REFRESH_EXPIRES=30d
  expiry.setDate(expiry.getDate() + 30);

  return expiry;
}

  async sendOtp(dto: SendOtpDto) {
    const { expiresInSeconds } = await this.otpService.sendOtp(dto.phone);
    return {
      message: 'OTP sent successfully',
      expiresInSeconds,
    };
  }

async verifyOtp(dto: VerifyOtpDto) {
  await this.otpService.verifyOtp(
    dto.phone,
    dto.code,
  );

  let user =
    await this.usersRepository.findOne({
      where: {
        phone: dto.phone,
      },
    });

  let isNewUser = false;

if (!user) {
  user = this.usersRepository.create({
    phone: dto.phone,
    fullName: dto.fullName,
  });

  user =
    await this.usersRepository.save(user);

  isNewUser = true;
} else if (!user.fullName && dto.fullName) {
  user.fullName = dto.fullName;

  user =
    await this.usersRepository.save(user);
}

  // Create temporary session
  const session =
    await this.userSessionsService.createSession({
      userId: user.id,

      refreshToken: '',

      expiresAt: this.getRefreshTokenExpiry(),

      deviceId:
        dto.deviceId || 
        crypto.randomUUID(),

      deviceName: dto.deviceName,

      platform: dto.platform,

      appVersion: dto.appVersion,

      pushToken: dto.pushToken,
    });

  // Generate JWTs
  const {
    accessToken,
    refreshToken,
  } = await this.generateTokens(
    user,
    session.id,
  );

  // Save refresh token hash
  await this.userSessionsService.updateRefreshToken(
    session.id,
    refreshToken,
    this.getRefreshTokenExpiry(),
  );

  return {
    accessToken,
    refreshToken,
    user,
    isNewUser,
  };
}

async guestLogin(dto: GuestLoginDto) {
  const raw = dto.phone.trim();
  const cleanDigits = raw.replace(/\D/g, '');
  const candidate1 = raw;
  const candidate2 = cleanDigits.length === 10 ? cleanDigits : (cleanDigits.length > 10 ? cleanDigits.slice(-10) : cleanDigits);
  const candidate3 = `+91${candidate2}`;

  let user = await this.usersRepository.findOne({
    where: [
      { phone: candidate1 },
      { phone: candidate2 },
      { phone: candidate3 },
    ],
  });

  let isNewUser = false;

  if (!user) {
    user = this.usersRepository.create({
      phone: raw,
      fullName: dto.fullName || 'Guest',
    });
    user = await this.usersRepository.save(user);
    isNewUser = true;
  } else if (!user.fullName && dto.fullName) {
    user.fullName = dto.fullName;
    user = await this.usersRepository.save(user);
  }

  const session = await this.userSessionsService.createSession({
    userId: user.id,
    refreshToken: '',
    expiresAt: this.getRefreshTokenExpiry(),
    deviceId: dto.deviceId || crypto.randomUUID(),
  });

  const { accessToken, refreshToken } = await this.generateTokens(
    user,
    session.id,
  );

  await this.userSessionsService.updateRefreshToken(
    session.id,
    refreshToken,
    this.getRefreshTokenExpiry(),
  );

  return {
    accessToken,
    refreshToken,
    user,
    isNewUser,
  };
}

async me(userId: string): Promise<User> {
  const user = await this.usersRepository.findOne({
    where: {
      id: userId,
      isActive: true,
    },
  });

  if (!user) {
    throw new UnauthorizedException(
      'User not found.',
    );
  }

  return user;
}

async refreshToken(data: {
  user: User;
  session: UserSession;
  refreshToken: string;
}) {
  const {
    user,
    session,
    refreshToken,
  } = data;

  // Verify that the raw refresh token matches
  // the hash stored in the database.
  await this.userSessionsService.verifyRefreshToken(
    session.id,
    refreshToken,
  );

  // Generate a fresh access & refresh token.
  const {
    accessToken,
    refreshToken: newRefreshToken,
  } = await this.generateTokens(
    user,
    session.id,
  );

  // Rotate refresh token.
  await this.userSessionsService.updateRefreshToken(
    session.id,
    newRefreshToken,
    this.getRefreshTokenExpiry(),
  );

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
}

async logout(data: {
  user: User;
  session: UserSession;
}) {
  await this.userSessionsService.revokeSession(
    data.session.id,
  );

  return {
    success: true,
    message: 'Logged out successfully.',
  };
}

async logoutAll(
  userId: string,
) {
  await this.userSessionsService.revokeAllSessions(
    userId,
  );

  return {
    success: true,
    message:
      'Logged out from all devices successfully.',
  };
}

async getSessions(
  userId: string,
  currentSessionId: string,
) {
  const sessions =
    await this.userSessionsService.getUserSessions(
      userId,
    );

  return sessions.map((session) => ({
    id: session.id,

    deviceId: session.deviceId,

    deviceName:
      session.deviceName,

    platform:
      session.platform,

    appVersion:
      session.appVersion,

    pushToken:
      session.pushToken,

    ipAddress:
      session.ipAddress,

    userAgent:
      session.userAgent,

    createdAt:
      session.createdAt,

    lastUsedAt:
      session.lastUsedAt,

    expiresAt:
      session.expiresAt,

    current:
      session.id === currentSessionId,
  }));
}

async removeSession(
  userId: string,
  currentSessionId: string,
  sessionId: string,
) {
  const session =
    await this.userSessionsService.findById(
      sessionId,
    );

  if (session.userId !== userId) {
    throw new UnauthorizedException(
      'You cannot remove this session.',
    );
  }

  if (session.id === currentSessionId) {
    throw new BadRequestException(
      'Use /auth/logout to logout from the current device.',
    );
  }

  await this.userSessionsService.revokeSession(
    sessionId,
  );

  return {
    success: true,
    message: 'Session removed successfully.',
  };
}

async updateProfile(userId: string, fullName: string): Promise<{ fullName: string }> {
  const user = await this.usersRepository.findOne({ where: { id: userId, isActive: true } });
  if (!user) {
    throw new BadRequestException('User not found.');
  }
  if (!fullName || !fullName.trim()) {
    throw new BadRequestException('Name cannot be empty.');
  }
  user.fullName = fullName.trim();
  await this.usersRepository.save(user);
  return { fullName: user.fullName };
}


}
