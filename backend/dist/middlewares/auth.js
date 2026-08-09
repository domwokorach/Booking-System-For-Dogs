import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";
export function requireAuth(req, _res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return next(new HttpError(401, "Missing or invalid authorization token."));
    }
    const token = header.slice("Bearer ".length);
    try {
        const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
        req.user = {
            userId: payload.userId,
            email: payload.email,
        };
        return next();
    }
    catch {
        return next(new HttpError(401, "Invalid or expired token."));
    }
}
