var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { createHash, randomBytes } from "node:crypto";
import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { AppointmentStatus, PaymentStatus, Prisma } from "@prisma/client";
import argon2 from "argon2";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { EmailService } from "../notifications/email.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
let UsersService = class UsersService {
    prisma;
    emailService;
    constructor(prisma, emailService) {
        this.prisma = prisma;
        this.emailService = emailService;
    }
    async confirmAccountDeletion(body) {
        const tokenHash = this.hashAccountDeletionToken(body.token);
        const storedRequest = await this.prisma.accountDeletionRequest.findUnique({
            where: { tokenHash },
            include: {
                user: {
                    select: { id: true },
                },
            },
        });
        if (!storedRequest || storedRequest.expiresAt < new Date()) {
            throw new HttpException("This account deletion link is invalid or has expired.", HttpStatus.BAD_REQUEST);
        }
        if (storedRequest.status === "CANCELLED") {
            throw new HttpException("This account deletion request has been cancelled.", HttpStatus.CONFLICT);
        }
        const unresolvedFinancialWorkflow = await this.prisma.appointment.count({
            where: {
                userId: storedRequest.user.id,
                OR: [
                    { status: AppointmentStatus.CancellationPending },
                    {
                        payments: {
                            some: {
                                status: {
                                    in: [
                                        PaymentStatus.RefundPending,
                                        PaymentStatus.RefundFailed,
                                    ],
                                },
                            },
                        },
                    },
                ],
            },
        });
        if (unresolvedFinancialWorkflow > 0) {
            throw new HttpException("This account cannot be deleted while a cancellation or refund is still processing.", HttpStatus.CONFLICT);
        }
        await this.prisma.$transaction(async (transaction) => {
            const claimed = await transaction.accountDeletionRequest.updateMany({
                where: {
                    id: storedRequest.id,
                    tokenHash,
                    status: "PENDING",
                    expiresAt: { gt: new Date() },
                },
                data: { status: "COMPLETED" },
            });
            if (claimed.count !== 1) {
                throw new HttpException("This account deletion request is no longer pending.", HttpStatus.CONFLICT);
            }
            const unresolvedFinancialWorkflow = await transaction.appointment.count({
                where: {
                    userId: storedRequest.user.id,
                    OR: [
                        { status: AppointmentStatus.CancellationPending },
                        {
                            payments: {
                                some: {
                                    status: {
                                        in: [
                                            PaymentStatus.RefundPending,
                                            PaymentStatus.RefundFailed,
                                        ],
                                    },
                                },
                            },
                        },
                    ],
                },
            });
            if (unresolvedFinancialWorkflow > 0) {
                throw new HttpException("This account cannot be deleted while a cancellation or refund is unresolved.", HttpStatus.CONFLICT);
            }
            await transaction.user.delete({
                where: { id: storedRequest.user.id },
            });
        });
        return {
            success: true,
            message: "Your account and appointments have been permanently deleted.",
        };
    }
    async cancelAccountDeletion(body) {
        const tokenHash = this.hashAccountDeletionToken(body.token);
        const storedRequest = await this.prisma.accountDeletionRequest.findUnique({
            where: { tokenHash },
            select: {
                id: true,
                status: true,
                expiresAt: true,
            },
        });
        if (!storedRequest || storedRequest.expiresAt < new Date()) {
            throw new HttpException("This account deletion link is invalid or has expired.", HttpStatus.BAD_REQUEST);
        }
        if (storedRequest.status === "CANCELLED") {
            return {
                success: true,
                status: "CANCELLED",
                message: "The account deletion request is already cancelled. Your account remains active.",
            };
        }
        const cancelled = await this.prisma.accountDeletionRequest.updateMany({
            where: {
                id: storedRequest.id,
                tokenHash,
                status: "PENDING",
                expiresAt: { gt: new Date() },
            },
            data: {
                status: "CANCELLED",
                cancelledAt: new Date(),
            },
        });
        if (cancelled.count !== 1) {
            throw new HttpException("This account deletion request is no longer pending.", HttpStatus.CONFLICT);
        }
        return {
            success: true,
            status: "CANCELLED",
            message: "The account deletion request was cancelled. Your account remains active.",
        };
    }
    async getCurrentUser(currentUser) {
        const user = await this.prisma.user.findUnique({
            where: { id: currentUser.id },
            select: {
                id: true,
                customerReference: true,
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
            throw new HttpException("User not found.", HttpStatus.NOT_FOUND);
        }
        return user;
    }
    async updateCurrentUser(currentUser, body) {
        try {
            return await this.prisma.user.update({
                where: { id: currentUser.id },
                data: {
                    firstName: body.firstName,
                    surname: body.surname,
                    address: body.homeAddress,
                    mobileNumber: body.mobileNumber,
                },
                select: {
                    id: true,
                    customerReference: true,
                    firstName: true,
                    surname: true,
                    email: true,
                    address: true,
                    mobileNumber: true,
                    updatedAt: true,
                },
            });
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2025") {
                throw new HttpException("User not found.", HttpStatus.NOT_FOUND);
            }
            throw error;
        }
    }
    async changePassword(currentUser, body) {
        const user = await this.prisma.user.findUnique({
            where: { id: currentUser.id },
            select: {
                id: true,
                passwordHash: true,
            },
        });
        if (!user) {
            throw new HttpException("User not found.", HttpStatus.NOT_FOUND);
        }
        if (!(await this.verifyPassword(body.currentPassword, user.passwordHash))) {
            throw new HttpException("Current password is incorrect.", HttpStatus.UNAUTHORIZED);
        }
        const passwordHash = await argon2.hash(body.newPassword);
        await this.prisma.$transaction(async (transaction) => {
            await transaction.user.update({
                where: { id: user.id },
                data: { passwordHash },
            });
            await transaction.refreshToken.updateMany({
                where: { userId: user.id, revokedAt: null },
                data: { revokedAt: new Date() },
            });
        });
        return {
            success: true,
            message: "Password updated successfully.",
        };
    }
    async requestAccountDeletion(currentUser, body) {
        const administratorEmail = env.BOOKING_EMAIL_TO.trim();
        if (!administratorEmail) {
            throw new HttpException("Account deletion approval is unavailable because the administrator email is not configured.", HttpStatus.SERVICE_UNAVAILABLE);
        }
        const user = await this.prisma.user.findUnique({
            where: { id: currentUser.id },
            select: {
                id: true,
                passwordHash: true,
                firstName: true,
                email: true,
            },
        });
        if (!user) {
            throw new HttpException("User not found.", HttpStatus.NOT_FOUND);
        }
        if (!(await this.verifyPassword(body.currentPassword, user.passwordHash))) {
            throw new HttpException("Current password is incorrect.", HttpStatus.UNAUTHORIZED);
        }
        const rawToken = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        const deletionRequest = await this.prisma.accountDeletionRequest.upsert({
            where: { userId: user.id },
            update: {
                tokenHash: this.hashAccountDeletionToken(rawToken),
                status: "PENDING",
                expiresAt,
                cancelledAt: null,
            },
            create: {
                userId: user.id,
                tokenHash: this.hashAccountDeletionToken(rawToken),
                status: "PENDING",
                expiresAt,
            },
            select: { id: true },
        });
        const frontendUrl = env.FRONTEND_URL.replace(/\/$/, "");
        const emailDelivered = await this.emailService.sendAccountDeletionRequest({
            to: user.email,
            firstName: user.firstName,
            requestId: deletionRequest.id,
            confirmationUrl: `${frontendUrl}/?deleteAccountToken=${rawToken}`,
            cancellationUrl: `${frontendUrl}/?cancelDeleteAccountToken=${rawToken}`,
            adminRecipient: administratorEmail,
        });
        return {
            success: true,
            status: "PENDING",
            emailDelivered,
            message: emailDelivered
                ? "Your deletion request is pending approval. Dominic has been notified."
                : "Your deletion request is pending approval, but the approval email could not be delivered. Contact support before the request expires.",
        };
    }
    hashAccountDeletionToken(token) {
        return createHash("sha256").update(token).digest("hex");
    }
    async verifyPassword(password, passwordHash) {
        if (passwordHash.startsWith("$2a$") ||
            passwordHash.startsWith("$2b$") ||
            passwordHash.startsWith("$2y$")) {
            return bcrypt.compare(password, passwordHash);
        }
        return argon2.verify(passwordHash, password);
    }
};
UsersService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService,
        EmailService])
], UsersService);
export { UsersService };
