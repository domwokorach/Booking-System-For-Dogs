import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

type JwtPayload = {
  userId: string;
  email: string;
};

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return next(new HttpError(401, "Missing or invalid authorization token."));
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = {
      userId: payload.userId,
      email: payload.email,
    };
    return next();
  } catch {
    return next(new HttpError(401, "Invalid or expired token."));
  }
}
