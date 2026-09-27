import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';

import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { GuestLoginDto } from './dto/guest-login.dto';

import { JwtAuthGuard } from './guards/jwt-auth.guard';

import { GetUser } from '../../common/decorators/get-user.decorator';
import { RefreshJwtAuthGuard } from './guards/refresh-jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { UserSession } from '../user-sessions/entities/user-session.entity';
import { JwtService } from '@nestjs/jwt';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Send OTP
   */
  @Post('send-otp')
  @Throttle({
  default: {
    limit: 3,
    ttl: 60_000,
  },
})
  @HttpCode(HttpStatus.OK)
  sendOtp(
    @Body() dto: SendOtpDto,
  ) {
    return this.authService.sendOtp(dto);
  }

  /**
   * Verify OTP
   */
  @Post('verify-otp')
  @Throttle({
  default: {
    limit: 10,
    ttl: 60_000,
  },
})
  @HttpCode(HttpStatus.OK)
  verifyOtp(
    @Body() dto: VerifyOtpDto,
  ) {
    return this.authService.verifyOtp(dto);
  }

  /**
   * Guest Login (Direct phone authentication for dine-in checkout without OTP roadblock)
   */
  @Post('guest')
  @HttpCode(HttpStatus.OK)
  guestLogin(
    @Body() dto: GuestLoginDto,
  ) {
    return this.authService.guestLogin(dto);
  }

  /**
   * Refresh Access Token
   */
@Post('refresh')
  @Throttle({
  default: {
    limit: 30,
    ttl: 60_000,
  },
})
@HttpCode(HttpStatus.OK)
@UseGuards(RefreshJwtAuthGuard)
refreshToken(
  @GetUser() auth: {
    user: User;
    session: UserSession;
    refreshToken: string;
  },
) {
  return this.authService.refreshToken(auth);
}

  /**
   * Current Logged-in User
   */
  @Get('me')
    @Throttle({
  default: {
    limit: 120,
    ttl: 60_000,
  },
})
  @UseGuards(JwtAuthGuard)
  me(
    @GetUser('user.id') userId: string,
  ) {
    return this.authService.me(userId);
  }

  @Post('logout')
@HttpCode(HttpStatus.OK)
@UseGuards(JwtAuthGuard)
logout(
  @GetUser() auth: {
    user: User;
    session: UserSession;
  },
) {
  return this.authService.logout(auth);
}

@Post('logout-all')
@HttpCode(HttpStatus.OK)
@UseGuards(JwtAuthGuard)
logoutAll(
  @GetUser('user.id')
  userId: string,
) {
  return this.authService.logoutAll(userId);
}

@Get('sessions')
@UseGuards(JwtAuthGuard)
getSessions(
  @GetUser() auth: {
    user: User;
    session: UserSession;
  },
) {
  return this.authService.getSessions(
    auth.user.id,
    auth.session.id,
  );
}

@Delete('sessions/:sessionId')
@UseGuards(JwtAuthGuard)
removeSession(
  @GetUser('user.id')
  userId: string,

  @GetUser('session.id')
  currentSessionId: string,

  @Param('sessionId')
  sessionId: string,
) {
  return this.authService.removeSession(
    userId,
    currentSessionId,
    sessionId,
  );
}

  /**
   * Update own profile (e.g. set fullName for users who signed up without one)
   */
  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @GetUser('user.id') userId: string,
    @Body() dto: { fullName: string },
  ) {
    return this.authService.updateProfile(userId, dto.fullName);
  }

}