import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Needed so the Razorpay webhook can verify its HMAC
    // signature against the exact bytes Razorpay sent.
    rawBody: true,
  });

  const config = app.get(ConfigService);

  const apiPrefix = config.get<string>('apiPrefix') ?? 'api/v1';
  const port = config.get<number>('port') ?? 3000;

  app.setGlobalPrefix(apiPrefix);

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new TransformInterceptor(),
  );

  await app.listen(port, '0.0.0.0');

  console.log(`🚀 API running on port ${port}`);
}

bootstrap();