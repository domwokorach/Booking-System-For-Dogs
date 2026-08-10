import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";

import type { AuthUser } from "./auth.types.js";
import { AuthTokenService } from "./auth-token.service.js";

type AuthenticatedRequest = Request & {
  user?: AuthUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authTokenService: AuthTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new HttpException(
        "Missing or invalid authorization token.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    try {
      request.user = this.authTokenService.verifyAccessToken(
        authorization.slice("Bearer ".length),
      );
      return true;
    } catch {
      throw new HttpException(
        "Invalid or expired token.",
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
