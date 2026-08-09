import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
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
function signToken(user) {
    const options = {
        expiresIn: env.JWT_EXPIRES_IN,
    };
    return jwt.sign({ userId: user.id, email: user.email }, env.JWT_SECRET, options);
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
        const passwordHash = await bcrypt.hash(body.password, 12);
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
        const token = signToken({ id: user.id, email: user.email });
        return res.status(201).json({
            user,
            token,
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
        const validPassword = await bcrypt.compare(body.password, user.passwordHash);
        if (!validPassword) {
            throw new HttpError(401, "Invalid email or password.");
        }
        const token = signToken({ id: user.id, email: user.email });
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
        });
    }
    catch (error) {
        return next(error);
    }
});
export default router;
