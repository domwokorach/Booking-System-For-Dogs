import { Router } from "express";
import argon2 from "argon2";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
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
async function verifyPassword(password, passwordHash) {
    if (passwordHash.startsWith("$2a$") || passwordHash.startsWith("$2b$") || passwordHash.startsWith("$2y$")) {
        return bcrypt.compare(password, passwordHash);
    }
    return argon2.verify(passwordHash, password);
}
router.use(requireAuth);
router.get("/me", async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
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
    }
    catch (error) {
        return next(error);
    }
});
router.patch("/me", async (req, res, next) => {
    try {
        const body = updateProfileSchema.parse(req.body);
        const updated = await prisma.user.update({
            where: { id: req.user.userId },
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
    }
    catch (error) {
        return next(error);
    }
});
router.patch("/me/password", async (req, res, next) => {
    try {
        const body = changePasswordSchema.parse(req.body);
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
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
    }
    catch (error) {
        return next(error);
    }
});
router.delete("/me", async (req, res, next) => {
    try {
        await prisma.user.delete({
            where: { id: req.user.userId },
        });
        return res.status(204).send();
    }
    catch (error) {
        return next(error);
    }
});
export default router;
