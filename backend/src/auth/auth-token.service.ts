import { createHash, randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../config/env.js";
import type { AuthUser } from "./auth.types.js";

type TokenUser = {
  id: string;
  email: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
};

type RefreshAuthUser = AuthUser & {
  type: "refresh";
};

@Injectable()
export class AuthTokenService {
  signAccessToken(user: TokenUser): string {
    const options: SignOptions = {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
    };

    return jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      env.JWT_ACCESS_SECRET,
      options,
    );
  }

  signRefreshToken(user: TokenUser): string {
    const options: SignOptions = {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
      jwtid: randomUUID(),
    };

    return jwt.sign(
      { userId: user.id, email: user.email, role: user.role, type: "refresh" },
      env.JWT_REFRESH_SECRET,
      options,
    );
  }

  verifyAccessToken(token: string): AuthUser {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);

    if (
      typeof payload !== "object" ||
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.exp !== "number"
    ) {
      throw new Error("Invalid access token payload.");
    }

    return {
      id: payload.userId,
      userId: payload.userId,
      email: payload.email,
      role: payload.role as 'CUSTOMER' | 'STAFF' | 'ADMIN',
      expiresAt: payload.exp * 1000,
    };
  }

  verifyRefreshToken(token: string): RefreshAuthUser {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);

    if (
      typeof payload !== "object" ||
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.exp !== "number" ||
      payload.type !== "refresh"
    ) {
      throw new Error("Invalid refresh token payload.");
    }

    return {
      id: payload.userId,
      userId: payload.userId,
      email: payload.email,
      role: payload.role as 'CUSTOMER' | 'STAFF' | 'ADMIN',
      expiresAt: payload.exp * 1000,
      type: "refresh",
    };
  }

  hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  getRefreshTokenExpiry(refreshToken: string): Date {
    const payload = jwt.decode(refreshToken);
    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof payload.exp !== "number"
    ) {
      throw new Error("Refresh token is missing an expiry.");
    }

    return new Date(payload.exp * 1000);
  }
}
