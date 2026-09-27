import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
  ) {
    console.log('========== JWT AUTH ==========');
    console.log('Error:', err);
    console.log('User:', user);
    console.log('Info:', info);

    if (err || !user) {
      throw err || new UnauthorizedException(
        info?.message ?? 'Unauthorized',
      );
    }

    return user;
  }
}