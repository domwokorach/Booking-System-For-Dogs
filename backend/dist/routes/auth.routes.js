import { Router } from "express";
import argon2 from "argon2";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { sendPasswordResetEmail } from "../services/email.service.js";
import { HttpError } from "../utils/http-error.js";
const router = Router();
const registerSchema = z.object({
    firstName: z.string().min(1),
    surname: z.string().min(1),
    email: z.string().email(),
    homeAddress: z.string().min(1),
    mobileNumber: z.string().min(1),
    password: z.string().min(8),
});
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
const refreshSchema = z.object({
    refreshToken: z.string().min(1),
});
const forgotPasswordSchema = z.object({
    email: z.string().email(),
});
const resetPasswordSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(8),
});
function signAccessToken(user) {
    const options = {
        expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    };
    return jwt.sign({ userId: user.id, email: user.email }, env.JWT_ACCESS_SECRET, options);
}
function signRefreshToken(user) {
    const options = {
        expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    };
    return jwt.sign({ userId: user.id, email: user.email, type: "refresh" }, env.JWT_REFRESH_SECRET, options);
}
async function verifyPassword(password, passwordHash) {
    if (passwordHash.startsWith("$2a$") || passwordHash.startsWith("$2b$") || passwordHash.startsWith("$2y$")) {
        return bcrypt.compare(password, passwordHash);
    }
    return argon2.verify(passwordHash, password);
}
function hashResetToken(token) {
    return createHash("sha256").update(token).digest("hex");
}
function hashRefreshToken(token) {
    return createHash("sha256").update(token).digest("hex");
}
function getRefreshTokenExpiry() {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}
async function persistRefreshToken(userId, refreshToken) {
    const tokenHash = hashRefreshToken(refreshToken);
    await prisma.refreshToken.create({
        data: {
            userId,
            tokenHash,
            expiresAt: getRefreshTokenExpiry(),
        },
    });
}
router.post("/register", async (req, res, next) => {
    try {
        const body = registerSchema.parse(req.body);
        const existing = await prisma.user.findUnique({
            where: { email: body.email.toLowerCase() },
            select: { id: true },
        });
        if (existing) {
            throw new HttpError(409, "An account with this email already exists.");
        }
        const passwordHash = await argon2.hash(body.password);
        const user = await prisma.user.create({
            data: {
                firstName: body.firstName,
                surname: body.surname,
                email: body.email.toLowerCase(),
                address: body.homeAddress,
                mobileNumber: body.mobileNumber,
                passwordHash,
            },
            select: {
                id: true,
                firstName: true,
                surname: true,
                email: true,
                address: true,
                mobileNumber: true,
            },
        });
        const token = signAccessToken({ id: user.id, email: user.email });
        const refreshToken = signRefreshToken({ id: user.id, email: user.email });
        await persistRefreshToken(user.id, refreshToken);
        return res.status(201).json({
            user,
            token,
            accessToken: token,
            refreshToken,
        });
    }
    catch (error) {
        return next(error);
    }
});
router.post("/login", async (req, res, next) => {
    try {
        const body = loginSchema.parse(req.body);
        const user = await prisma.user.findUnique({
            where: { email: body.email.toLowerCase() },
        });
        if (!user) {
            throw new HttpError(401, "Invalid email or password.");
        }
        const validPassword = await verifyPassword(body.password, user.passwordHash);
        if (!validPassword) {
            throw new HttpError(401, "Invalid email or password.");
        }
        const token = signAccessToken({ id: user.id, email: user.email });
        const refreshToken = signRefreshToken({ id: user.id, email: user.email });
        await persistRefreshToken(user.id, refreshToken);
        return res.json({
            user: {
                id: user.id,
                firstName: user.firstName,
                surname: user.surname,
                email: user.email,
                address: user.address,
                mobileNumber: user.mobileNumber,
            },
            token,
            accessToken: token,
            refreshToken,
        });
    }
    catch (error) {
        return next(error);
    }
});
router.post("/refresh", async (req, res, next) => {
    try {
        const body = refreshSchema.parse(req.body);
        const tokenHash = hashRefreshToken(body.refreshToken);
        const storedToken = await prisma.refreshToken.findUnique({
            where: { tokenHash },
            select: {
                id: true,
                userId: true,
                expiresAt: true,
                revokedAt: true,
            },
        });
        if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
            throw new HttpError(401, "Invalid refresh token.");
        }
        const payload = jwt.verify(body.refreshToken, env.JWT_REFRESH_SECRET);
        if (payload.type !== "refresh" || payload.userId !== storedToken.userId) {
            throw new HttpError(401, "Invalid refresh token.");
        }
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, email: true },
        });
        if (!user) {
            throw new HttpError(401, "Invalid refresh token.");
        }
        const accessToken = signAccessToken({ id: user.id, email: user.email });
        const refreshToken = signRefreshToken({ id: user.id, email: user.email });
        await prisma.$transaction([
            prisma.refreshToken.update({
                where: { id: storedToken.id },
                data: { revokedAt: new Date() },
            }),
            prisma.refreshToken.create({
                data: {
                    userId: user.id,
                    tokenHash: hashRefreshToken(refreshToken),
                    expiresAt: getRefreshTokenExpiry(),
                },
            }),
        ]);
        return res.json({
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        return next(error);
    }
});
router.post("/logout", async (req, res, next) => {
    try {
        const body = refreshSchema.parse(req.body);
        const tokenHash = hashRefreshToken(body.refreshToken);
        await prisma.refreshToken.updateMany({
            where: {
                tokenHash,
                revokedAt: null,
            },
            data: {
                revokedAt: new Date(),
            },
        });
        return res.json({
            success: true,
            message: "Logged out successfully.",
        });
    }
    catch (error) {
        return next(error);
    }
});
router.post("/forgot-password", async (req, res, next) => {
    try {
        const body = forgotPasswordSchema.parse(req.body);
        const user = await prisma.user.findUnique({
            where: { email: body.email.toLowerCase() },
            select: { id: true, firstName: true, email: true },
        });
        if (user) {
            const rawToken = randomBytes(32).toString("hex");
            const tokenHash = hashResetToken(rawToken);
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
            await prisma.passwordResetToken.deleteMany({
                where: { userId: user.id },
            });
            await prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    tokenHash,
                    expiresAt,
                },
            });
            const resetUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/reset-password?token=${rawToken}`;
            await sendPasswordResetEmail({
                to: user.email,
                firstName: user.firstName,
                resetUrl,
            });
        }
        return res.json({
            success: true,
            message: "If the email exists, a password reset link has been sent.",
        });
    }
    catch (error) {
        return next(error);
    }
});
router.post("/reset-password", async (req, res, next) => {
    try {
        const body = resetPasswordSchema.parse(req.body);
        const tokenHash = hashResetToken(body.token);
        const tokenRecord = await prisma.passwordResetToken.findUnique({
            where: { tokenHash },
            include: { user: true },
        });
        if (!tokenRecord || tokenRecord.usedAt || tokenRecord.expiresAt < new Date()) {
            throw new HttpError(400, "Invalid or expired reset token.");
        }
        const passwordHash = await argon2.hash(body.password);
        await prisma.$transaction([
            prisma.user.update({
                where: { id: tokenRecord.userId },
                data: { passwordHash },
            }),
            prisma.passwordResetToken.update({
                where: { id: tokenRecord.id },
                data: { usedAt: new Date() },
            }),
            prisma.passwordResetToken.deleteMany({
                where: {
                    userId: tokenRecord.userId,
                    id: { not: tokenRecord.id },
                },
            }),
        ]);
        return res.json({
            success: true,
            message: "Password reset successful.",
        });
    }
    catch (error) {
        return next(error);
    }
});
export default router;
