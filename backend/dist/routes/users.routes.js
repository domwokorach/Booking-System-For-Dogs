import { Router } from "express";
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
export default router;
