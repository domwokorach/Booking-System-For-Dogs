import {
  createParamDecorator,
  type ExecutionContext,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request } from "express";

import type { AuthUser } from "./auth.types.js";

type AuthenticatedRequest = Request & {
  user?: AuthUser;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new HttpException("Authentication required.", HttpStatus.UNAUTHORIZED);
    }

    return request.user;
  },
);
