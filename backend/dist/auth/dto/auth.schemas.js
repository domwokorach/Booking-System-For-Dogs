import { z } from "zod";
export const registerSchema = z.object({
    firstName: z.string().min(1),
    surname: z.string().min(1),
    email: z.string().email(),
    homeAddress: z.string().min(1),
    mobileNumber: z.string().min(1),
    password: z.string().min(8),
});
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
export const refreshSchema = z.object({
    refreshToken: z.string().min(1),
});
export const forgotPasswordSchema = z.object({
    email: z.string().email(),
});
export const resetPasswordSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(8),
});
