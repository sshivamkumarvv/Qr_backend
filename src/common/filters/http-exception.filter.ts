import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

let message: string | string[];

if (exception instanceof ThrottlerException) {
  message =
    'Too many requests. Please try again in a minute.';
} else if (
  exceptionResponse &&
  typeof exceptionResponse === 'object'
) {
  message = (exceptionResponse as any).message;
} else if (exception instanceof Error) {
  message = exception.message;
} else {
  message = 'Internal server error';
}

    this.logger.error(
      `${request.method} ${request.url} -> ${status}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

response.status(status).json({
  success: false,
  statusCode: status,
  path: request.url,
  timestamp: new Date().toISOString(),
  message,
});
  }
}
