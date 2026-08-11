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
import { BadRequestException, ConflictException, Injectable, NotFoundException, } from "@nestjs/common";
import { AppointmentStatus, Prisma } from "@prisma/client";
import { env } from "../config/env.js";
import { EmailService } from "../notifications/email.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { RealtimeGateway } from "../realtime/realtime.gateway.js";
import { AppointmentSlotsService } from "../scheduling/appointment-slots.service.js";
const publicUserSelect = {
    id: true,
    firstName: true,
    surname: true,
    email: true,
    address: true,
    mobileNumber: true,
};
const safeAppointmentInclude = {
    user: { select: publicUserSelect },
    serviceRef: true,
};
let AppointmentsService = class AppointmentsService {
    prisma;
    appointmentSlots;
    email;
    realtime;
    constructor(prisma, appointmentSlots, email, realtime) {
        this.prisma = prisma;
        this.appointmentSlots = appointmentSlots;
        this.email = email;
        this.realtime = realtime;
    }
    async available(date) {
        return {
            date,
            availableTimes: await this.appointmentSlots.getAvailableTimes(date),
        };
    }
    listMine(user) {
        return this.prisma.appointment.findMany({
            where: { userId: user.id },
            orderBy: { dateTime: "asc" },
        });
    }
    async availableForReschedule(user, id, date) {
        const existing = await this.findOwned(user.id, id);
        if (existing.status === AppointmentStatus.Cancelled) {
            throw new BadRequestException("Cancelled appointments cannot be rescheduled.");
        }
        return {
            appointmentId: existing.id,
            date,
            availableTimes: await this.appointmentSlots.getAvailableTimes(date, existing.durationMinutes, existing.id),
        };
    }
    async create(user, body) {
        const service = body.service
            ? await this.resolveActiveService(body.service)
            : null;
        let appointment;
        try {
            appointment = await this.appointmentSlots.withAvailableSlot({
                dateTime: body.dateTime,
                durationMinutes: service?.durationMinutes ?? 60,
                conflictMessage: "This appointment slot is already booked.",
            }, (transaction) => transaction.appointment.create({
                data: {
                    userId: user.id,
                    dateTime: body.dateTime,
                    serviceId: service?.id,
                    service: service?.name,
                    durationMinutes: service?.durationMinutes ?? 60,
                    notes: body.notes,
                    status: AppointmentStatus.Confirmed,
                    confirmedAt: new Date(),
                },
                include: safeAppointmentInclude,
            }));
        }
        catch (error) {
            this.rethrowSlotConflict(error, "This appointment slot is already booked.");
        }
        this.realtime.emitToUser(user.id, "appointments:created", {
            appointmentId: appointment.id,
            dateTime: appointment.dateTime,
            status: appointment.status,
        });
        await this.email.sendBookingConfirmation({
            to: appointment.user.email,
            firstName: appointment.user.firstName,
            bookingId: appointment.id,
            service: appointment.serviceRef?.name ?? appointment.service,
            appointmentDateTime: appointment.dateTime,
            status: appointment.status,
        });
        return {
            ...appointment,
            notificationRecipient: this.email.resolveBookingRecipient(appointment.user.email),
        };
    }
    async update(user, id, body) {
        const existing = await this.findOwned(user.id, id);
        const service = body.service
            ? await this.resolveActiveService(body.service)
            : null;
        const updateAppointment = async (transaction) => {
            const changed = await transaction.appointment.updateMany({
                where: {
                    id,
                    userId: user.id,
                    updatedAt: existing.updatedAt,
                },
                data: {
                    serviceId: body.service ? service?.id : undefined,
                    service: body.service ? service?.name : undefined,
                    durationMinutes: body.service ? service?.durationMinutes : undefined,
                    notes: body.notes,
                },
            });
            if (changed.count !== 1) {
                throw new ConflictException("The appointment changed. Please retry.");
            }
            return this.findOwned(user.id, id, transaction);
        };
        let updated;
        if (service && existing.status !== AppointmentStatus.Cancelled) {
            updated = await this.appointmentSlots.withAvailableSlot({
                dateTime: existing.dateTime,
                durationMinutes: service.durationMinutes,
                excludeAppointmentId: id,
                conflictMessage: "The selected service does not fit this appointment slot.",
            }, updateAppointment);
        }
        else {
            updated = await this.prisma.$transaction(updateAppointment);
        }
        this.realtime.emitToUser(user.id, "appointments:updated", {
            appointmentId: updated.id,
            dateTime: updated.dateTime,
            status: updated.status,
        });
        await this.email.sendBookingUpdate({
            to: updated.user.email,
            firstName: updated.user.firstName,
            appointmentDateTime: updated.dateTime,
            status: updated.status,
        });
        return {
            ...updated,
            notificationRecipient: this.email.resolveBookingRecipient(updated.user.email),
        };
    }
    async reschedule(user, id, body) {
        const existing = await this.findOwned(user.id, id);
        if (existing.status === AppointmentStatus.Cancelled) {
            throw new BadRequestException("Cancelled appointments cannot be rescheduled.");
        }
        let updated;
        try {
            updated = await this.appointmentSlots.withAvailableSlot({
                dateTime: body.dateTime,
                durationMinutes: existing.durationMinutes,
                excludeAppointmentId: id,
                conflictMessage: "The requested time is not available.",
            }, async (transaction) => {
                const changed = await transaction.appointment.updateMany({
                    where: {
                        id,
                        userId: user.id,
                        status: existing.status,
                        dateTime: existing.dateTime,
                        updatedAt: existing.updatedAt,
                    },
                    data: {
                        dateTime: body.dateTime,
                        rescheduledFrom: existing.dateTime,
                        notes: body.notes ?? existing.notes,
                        status: AppointmentStatus.Rescheduled,
                    },
                });
                if (changed.count !== 1) {
                    throw new ConflictException("The appointment state changed. Please retry.");
                }
                return this.findOwned(user.id, id, transaction);
            });
        }
        catch (error) {
            this.rethrowSlotConflict(error, "The requested time is not available.");
        }
        this.realtime.emitToUser(user.id, "appointments:rescheduled", {
            appointmentId: updated.id,
            dateTime: updated.dateTime,
            status: updated.status,
        });
        await this.email.sendBookingUpdate({
            to: updated.user.email,
            firstName: updated.user.firstName,
            appointmentDateTime: updated.dateTime,
            status: updated.status,
        });
        return {
            ...updated,
            notificationRecipient: this.email.resolveBookingRecipient(updated.user.email),
        };
    }
    async confirm(user, id) {
        const existing = await this.findOwned(user.id, id);
        if (existing.status === AppointmentStatus.Cancelled) {
            throw new BadRequestException("Cancelled appointments cannot be confirmed.");
        }
        if (existing.status === AppointmentStatus.Confirmed) {
            return existing;
        }
        const updated = await this.prisma.$transaction(async (transaction) => {
            const changed = await transaction.appointment.updateMany({
                where: {
                    id,
                    userId: user.id,
                    status: existing.status,
                    dateTime: existing.dateTime,
                    updatedAt: existing.updatedAt,
                },
                data: {
                    status: AppointmentStatus.Confirmed,
                    confirmedAt: new Date(),
                },
            });
            if (changed.count !== 1) {
                throw new ConflictException("The appointment state changed. Please retry.");
            }
            return this.findOwned(user.id, id, transaction);
        });
        this.realtime.emitToUser(user.id, "appointments:confirmed", {
            appointmentId: updated.id,
            dateTime: updated.dateTime,
            status: updated.status,
        });
        await this.email.sendBookingConfirmation({
            to: updated.user.email,
            firstName: updated.user.firstName,
            bookingId: updated.id,
            service: updated.serviceRef?.name ?? updated.service,
            appointmentDateTime: updated.dateTime,
            status: updated.status,
        });
        return updated;
    }
    async cancel(user, id) {
        const existing = await this.findOwned(user.id, id);
        if (existing.status === AppointmentStatus.Cancelled) {
            return existing;
        }
        const updated = await this.prisma.$transaction(async (transaction) => {
            const changed = await transaction.appointment.updateMany({
                where: {
                    id,
                    userId: user.id,
                    status: existing.status,
                    dateTime: existing.dateTime,
                    updatedAt: existing.updatedAt,
                },
                data: {
                    status: AppointmentStatus.Cancelled,
                    cancelledAt: new Date(),
                },
            });
            if (changed.count !== 1) {
                throw new ConflictException("The appointment state changed. Please retry.");
            }
            return this.findOwned(user.id, id, transaction);
        });
        this.realtime.emitToUser(user.id, "appointments:cancelled", {
            appointmentId: updated.id,
            dateTime: updated.dateTime,
            status: updated.status,
        });
        await this.email.sendBookingCancellation({
            to: updated.user.email,
            firstName: updated.user.firstName,
            bookingId: updated.id,
            service: updated.serviceRef?.name ?? updated.service,
            appointmentDateTime: updated.dateTime,
            status: updated.status,
        });
        return updated;
    }
    async approveDeletion(token) {
        const tokenHash = this.hashAppointmentDeletionToken(token);
        const request = await this.prisma.appointmentDeletionRequest.findUnique({
            where: { tokenHash },
            include: { appointment: { include: safeAppointmentInclude } },
        });
        if (!request || request.expiresAt <= new Date()) {
            throw new BadRequestException("This deletion approval link is invalid, expired, or already used.");
        }
        const appointment = request.appointment;
        await this.prisma.$transaction(async (transaction) => {
            const claimed = await transaction.appointmentDeletionRequest.deleteMany({
                where: {
                    id: request.id,
                    tokenHash,
                    expiresAt: { gt: new Date() },
                },
            });
            if (claimed.count !== 1) {
                throw new BadRequestException("This deletion approval link is invalid, expired, or already used.");
            }
            const deleted = await transaction.appointment.deleteMany({
                where: {
                    id: request.appointmentId,
                    deleteRequestedAt: { not: null },
                },
            });
            if (deleted.count !== 1) {
                throw new ConflictException("The deletion request is no longer valid.");
            }
        });
        this.realtime.emitToUser(appointment.userId, "appointments:deleted", {
            appointmentId: appointment.id,
        });
        await this.email.sendBookingCancellation({
            to: appointment.user.email,
            firstName: appointment.user.firstName,
            bookingId: appointment.id,
            service: appointment.serviceRef?.name ?? appointment.service,
            appointmentDateTime: appointment.dateTime,
            status: appointment.status,
        });
        return {
            success: true,
            appointmentId: appointment.id,
            message: "Appointment deletion approved and completed.",
        };
    }
    async requestDeletion(user, id) {
        await this.findOwned(user.id, id);
        const rawToken = randomBytes(32).toString("hex");
        const tokenHash = this.hashAppointmentDeletionToken(rawToken);
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        const updated = await this.prisma.$transaction(async (transaction) => {
            const changed = await transaction.appointment.updateMany({
                where: { id, userId: user.id },
                data: { deleteRequestedAt: new Date() },
            });
            if (changed.count !== 1) {
                throw new ConflictException("The appointment state changed. Please retry.");
            }
            await transaction.appointmentDeletionRequest.upsert({
                where: { appointmentId: id },
                update: { tokenHash, expiresAt, createdAt: new Date() },
                create: { appointmentId: id, tokenHash, expiresAt },
            });
            return this.findOwned(user.id, id, transaction);
        });
        this.realtime.emitToUser(user.id, "appointments:updated", {
            appointmentId: updated.id,
            dateTime: updated.dateTime,
            status: updated.status,
        });
        const approvalUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/?deleteAppointmentToken=${rawToken}`;
        const emailDelivered = await this.email.sendDeletionRequest({
            to: updated.user.email,
            firstName: updated.user.firstName,
            bookingId: updated.id,
            service: updated.serviceRef?.name ?? updated.service,
            appointmentDateTime: updated.dateTime,
            status: updated.status,
            approvalUrl,
        });
        return {
            success: true,
            appointmentId: updated.id,
            expiresAt,
            emailDelivered,
            message: emailDelivered
                ? "Deletion approval link sent to the administrator."
                : "Deletion request created, but the approval email could not be delivered.",
        };
    }
    async sendConfirmation(user, id) {
        const appointment = await this.findOwned(user.id, id);
        await this.email.sendBookingConfirmation({
            to: appointment.user.email,
            firstName: appointment.user.firstName,
            bookingId: appointment.id,
            service: appointment.serviceRef?.name ?? appointment.service,
            appointmentDateTime: appointment.dateTime,
            status: appointment.status,
        });
        return { message: "Booking confirmation email sent." };
    }
    async sendUpdate(user, id) {
        const appointment = await this.findOwned(user.id, id);
        await this.email.sendBookingUpdate({
            to: appointment.user.email,
            firstName: appointment.user.firstName,
            appointmentDateTime: appointment.dateTime,
            status: appointment.status,
        });
        return { message: "Booking update email sent." };
    }
    async sendCancellation(user, id) {
        const appointment = await this.findOwned(user.id, id);
        await this.email.sendBookingCancellation({
            to: appointment.user.email,
            firstName: appointment.user.firstName,
            bookingId: appointment.id,
            service: appointment.serviceRef?.name ?? appointment.service,
            appointmentDateTime: appointment.dateTime,
            status: appointment.status,
        });
        return { message: "Booking cancellation email sent." };
    }
    async resolveActiveService(id) {
        const service = await this.prisma.service.findFirst({
            where: { id, active: true },
            select: { id: true, name: true, durationMinutes: true },
        });
        if (!service) {
            throw new NotFoundException("Service not found.");
        }
        return service;
    }
    async findOwned(userId, id, client = this.prisma) {
        const appointment = await client.appointment.findFirst({
            where: { id, userId },
            include: safeAppointmentInclude,
        });
        if (!appointment) {
            throw new NotFoundException("Appointment not found.");
        }
        return appointment;
    }
    hashAppointmentDeletionToken(token) {
        return createHash("sha256").update(token).digest("hex");
    }
    rethrowSlotConflict(error, message) {
        if ((error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002") ||
            (error instanceof Prisma.PrismaClientUnknownRequestError &&
                error.message.includes("Appointment_no_active_time_overlap"))) {
            throw new ConflictException(message);
        }
        throw error;
    }
};
AppointmentsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService,
        AppointmentSlotsService,
        EmailService,
        RealtimeGateway])
], AppointmentsService);
export { AppointmentsService };
