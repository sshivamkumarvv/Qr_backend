import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

export const GetUser = createParamDecorator(
  (
    data: string | undefined,
    ctx: ExecutionContext,
  ) => {
    const request =
      ctx.switchToHttp().getRequest();

    const auth = request.user;

    if (!data) {
      return auth;
    }

    const keys = data.split('.');

    let value = auth;

    for (const key of keys) {
      value = value?.[key];
    }

    return value;
  },
);