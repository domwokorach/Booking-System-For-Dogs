import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

export type JwtPayload = {
  userId: string;
  email: string;
};

export function verifyAccessToken(token: string): JwtPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);

  if (
    typeof payload !== "object" ||
    typeof payload.userId !== "string" ||
    typeof payload.email !== "string"
  ) {
    throw new Error("Invalid access token payload.");
  }

  return {
    userId: payload.userId,
    email: payload.email,
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return next(new HttpError(401, "Missing or invalid authorization token."));
  }

  const token = header.slice("Bearer ".length);

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return next(new HttpError(401, "Invalid or expired token."));
  }
}
