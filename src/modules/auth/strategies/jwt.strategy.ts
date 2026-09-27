import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { UserSession } from '../../user-sessions/entities/user-session.entity';

export interface JwtPayload {
  sub: string;
  sid: string;
  phone: string;
  role: string;
}

export interface AuthenticatedUser {
  id: string;
  fullName: string | null;
  phone: string;
  email: string | null;
  role: string;
  isActive: boolean;

  sessionId: string;

  user: User;
  session: UserSession;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(
  Strategy,
  'jwt',
) {
  constructor(
    private readonly configService: ConfigService,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(UserSession)
    private readonly userSessionsRepository: Repository<UserSession>,
  ) {
    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey: configService.getOrThrow<string>(
        'jwt.access.secret',
      ),
    });
  }

  async validate(
    payload: JwtPayload,
  ): Promise<AuthenticatedUser> {
    const session =
      await this.userSessionsRepository.findOne({
        where: {
          id: payload.sid,
          userId: payload.sub,
          isRevoked: false,
        },
      });

    if (!session) {
      throw new UnauthorizedException(
        'Session not found.',
      );
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Session expired.',
      );
    }

    const user =
      await this.usersRepository.findOne({
        where: {
          id: payload.sub,
          isActive: true,
        },
      });

    if (!user) {
      throw new UnauthorizedException(
        'User not found.',
      );
    }

    session.lastUsedAt = new Date();

    await this.userSessionsRepository.save(session);

    return {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role,
      isActive: user.isActive,

      sessionId: session.id,

      user,
      session,
    };
  }
}