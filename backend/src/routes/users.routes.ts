import { Router } from "express";
import argon2 from "argon2";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middlewares/auth.js";
import { sendAccountDeletionRequestEmails } from "../services/email.service.js";
import { HttpError } from "../utils/http-error.js";

const router = Router();

const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  surname: z.string().min(1).optional(),
  homeAddress: z.string().min(1).optional(),
  mobileNumber: z.string().min(1).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const deleteAccountSchema = z.object({
  currentPassword: z.string().min(1),
  confirmation: z.literal("DELETE"),
});

const confirmDeleteAccountSchema = z.object({
  token: z.string().min(1),
});

async function verifyPassword(password: string, passwordHash: string) {
  if (passwordHash.startsWith("$2a$") || passwordHash.startsWith("$2b$") || passwordHash.startsWith("$2y$")) {
    return bcrypt.compare(password, passwordHash);
  }

  return argon2.verify(passwordHash, password);
}

function hashAccountDeletionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

router.post("/delete-account/confirm", async (req, res, next) => {
  try {
    const body = confirmDeleteAccountSchema.parse(req.body);
    const tokenHash = hashAccountDeletionToken(body.token);
    const storedRequest = await prisma.accountDeletionRequest.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: { id: true },
        },
      },
    });

    if (!storedRequest || storedRequest.expiresAt < new Date()) {
      throw new HttpError(400, "This account deletion link is invalid or has expired.");
    }

    if (storedRequest.status === "CANCELLED") {
      throw new HttpError(409, "This account deletion request has been cancelled.");
    }

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.accountDeletionRequest.updateMany({
        where: {
          id: storedRequest.id,
          status: "PENDING",
        },
        data: { status: "COMPLETED" },
      });

      if (claimed.count !== 1) {
        throw new HttpError(409, "This account deletion request is no longer pending.");
      }

      await tx.user.delete({
        where: { id: storedRequest.user.id },
      });
    });

    return res.json({
      success: true,
      message: "Your account and appointments have been permanently deleted.",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/delete-account/cancel", async (req, res, next) => {
  try {
    const body = confirmDeleteAccountSchema.parse(req.body);
    const tokenHash = hashAccountDeletionToken(body.token);
    const storedRequest = await prisma.accountDeletionRequest.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!storedRequest || storedRequest.expiresAt < new Date()) {
      throw new HttpError(400, "This account deletion link is invalid or has expired.");
    }

    if (storedRequest.status === "CANCELLED") {
      return res.json({
        success: true,
        status: "CANCELLED",
        message: "The account deletion request is already cancelled. Your account remains active.",
      });
    }

    const cancelled = await prisma.accountDeletionRequest.updateMany({
      where: {
        id: storedRequest.id,
        status: "PENDING",
      },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });

    if (cancelled.count !== 1) {
      throw new HttpError(409, "This account deletion request is no longer pending.");
    }

    return res.json({
      success: true,
      status: "CANCELLED",
      message: "The account deletion request was cancelled. Your account remains active.",
    });
  } catch (error) {
    return next(error);
  }
});

router.use(requireAuth);

router.get("/me", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        firstName: true,
        surname: true,
        email: true,
        address: true,
        mobileNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new HttpError(404, "User not found.");
    }

    return res.json(user);
  } catch (error) {
    return next(error);
  }
});

router.patch("/me", async (req, res, next) => {
  try {
    const body = updateProfileSchema.parse(req.body);

    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        firstName: body.firstName,
        surname: body.surname,
        address: body.homeAddress,
        mobileNumber: body.mobileNumber,
      },
      select: {
        id: true,
        firstName: true,
        surname: true,
        email: true,
        address: true,
        mobileNumber: true,
        updatedAt: true,
      },
    });

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

router.patch("/me/password", async (req, res, next) => {
  try {
    const body = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new HttpError(404, "User not found.");
    }

    const validPassword = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!validPassword) {
      throw new HttpError(401, "Current password is incorrect.");
    }

    const passwordHash = await argon2.hash(body.newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return res.json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/me/delete-request", async (req, res, next) => {
  try {
    const body = deleteAccountSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        passwordHash: true,
        firstName: true,
        email: true,
      },
    });

    if (!user) {
      throw new HttpError(404, "User not found.");
    }

    const validPassword = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!validPassword) {
      throw new HttpError(401, "Current password is incorrect.");
    }

    const rawToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const deletionRequest = await prisma.accountDeletionRequest.upsert({
      where: { userId: user.id },
      update: {
        tokenHash: hashAccountDeletionToken(rawToken),
        status: "PENDING",
        expiresAt,
        cancelledAt: null,
      },
      create: {
        userId: user.id,
        tokenHash: hashAccountDeletionToken(rawToken),
        status: "PENDING",
        expiresAt,
      },
      select: { id: true },
    });

    const confirmationUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/?deleteAccountToken=${rawToken}`;
    const cancellationUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/?cancelDeleteAccountToken=${rawToken}`;
    await sendAccountDeletionRequestEmails({
      to: user.email,
      firstName: user.firstName,
      requestId: deletionRequest.id,
      confirmationUrl,
      cancellationUrl,
      adminRecipient: env.BOOKING_EMAIL_TO.trim() || "dominicolanya@gmail.com",
    });

    return res.status(202).json({
      success: true,
      status: "PENDING",
      message: "Your deletion request is pending. Check your email to confirm or cancel it within 30 minutes.",
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
