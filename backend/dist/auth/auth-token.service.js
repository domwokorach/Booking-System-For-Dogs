var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { createHash, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
let AuthTokenService = class AuthTokenService {
    signAccessToken(user) {
        const options = {
            expiresIn: env.JWT_ACCESS_EXPIRES_IN,
        };
        return jwt.sign({ userId: user.id, email: user.email }, env.JWT_ACCESS_SECRET, options);
    }
    signRefreshToken(user) {
        const options = {
            expiresIn: env.JWT_REFRESH_EXPIRES_IN,
            jwtid: randomUUID(),
        };
        return jwt.sign({ userId: user.id, email: user.email, type: "refresh" }, env.JWT_REFRESH_SECRET, options);
    }
    verifyAccessToken(token) {
        const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
        if (typeof payload !== "object" ||
            typeof payload.userId !== "string" ||
            typeof payload.email !== "string" ||
            typeof payload.exp !== "number") {
            throw new Error("Invalid access token payload.");
        }
        return {
            id: payload.userId,
            userId: payload.userId,
            email: payload.email,
            expiresAt: payload.exp * 1000,
        };
    }
    verifyRefreshToken(token) {
        const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
        if (typeof payload !== "object" ||
            typeof payload.userId !== "string" ||
            typeof payload.email !== "string" ||
            typeof payload.exp !== "number" ||
            payload.type !== "refresh") {
            throw new Error("Invalid refresh token payload.");
        }
        return {
            id: payload.userId,
            userId: payload.userId,
            email: payload.email,
            expiresAt: payload.exp * 1000,
            type: "refresh",
        };
    }
    hashRefreshToken(token) {
        return createHash("sha256").update(token).digest("hex");
    }
    getRefreshTokenExpiry(refreshToken) {
        const payload = jwt.decode(refreshToken);
        if (typeof payload !== "object" ||
            payload === null ||
            typeof payload.exp !== "number") {
            throw new Error("Refresh token is missing an expiry.");
        }
        return new Date(payload.exp * 1000);
    }
};
AuthTokenService = __decorate([
    Injectable()
], AuthTokenService);
export { AuthTokenService };
