import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SignOptions } from 'jsonwebtoken';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OtpService } from './otp.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshJwtStrategy } from './strategies/refresh-jwt.strategy';

import { User } from '../users/entities/user.entity';
import { Otp } from './entities/otp.entity';

import { UserSessionsModule } from '../user-sessions/user-sessions.module';

import { SMS_PROVIDER } from './sms/sms-provider.interface';
import { ConsoleSmsProvider } from './sms/console-sms.provider';
import { UserSession } from '../user-sessions/entities/user-session.entity';
import { AuthCleanupService } from './auth-cleanup.service';

@Module({
  imports: [
    ConfigModule,

    TypeOrmModule.forFeature([
      User,
      Otp,
      UserSession
    ]),

    PassportModule.register({
      defaultStrategy: 'jwt',
    }),

    UserSessionsModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>(
          'jwt.access.secret',
        ),

        signOptions: {
          expiresIn: config.getOrThrow(
            'jwt.access.expiresIn',
          ) as SignOptions['expiresIn'],
        },
      }),
    }),
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    OtpService,
    JwtStrategy,
    RefreshJwtStrategy,
    AuthCleanupService,

    {
      provide: SMS_PROVIDER,
      useClass: ConsoleSmsProvider,
    },
  ],

  exports: [
    JwtModule,
    PassportModule,
    AuthService,
  ],
})
export class AuthModule {}