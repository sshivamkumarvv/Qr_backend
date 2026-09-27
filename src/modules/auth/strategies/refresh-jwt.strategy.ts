import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { ConfigService } from '@nestjs/config';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Request } from 'express';

import { User } from '../../users/entities/user.entity';
import { UserSessionsService } from '../../user-sessions/user-sessions.service';

export interface RefreshJwtPayload {
  sub: string;
  sid: string;
  type: 'refresh';
}

@Injectable()
export class RefreshJwtStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private readonly configService: ConfigService,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    private readonly userSessionsService: UserSessionsService,
  ) {
    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),

      passReqToCallback: true,

      ignoreExpiration: false,

      secretOrKey: configService.getOrThrow<string>(
        'jwt.refresh.secret',
      ),
    });
  }

  async validate(
    req: Request,
    payload: RefreshJwtPayload,
  ) {
    const authHeader =
      req.headers.authorization ?? '';

    const refreshToken = authHeader.replace(
      /^Bearer\s+/i,
      '',
    );

    const session =
      await this.userSessionsService.findActiveSession(
        payload.sid,
      );

    if (session.userId !== payload.sub) {
      throw new UnauthorizedException(
        'Invalid session.',
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

    return {
      user,
      session,
      refreshToken,
    };
  }
}