var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, } from "@nestjs/common";
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
        await this.email.sendBookingConfirmation({
            to: appointment.user.email,
            firstName: appointment.user.firstName,
            bookingId: appointment.id,
            service: appointment.serviceRef?.name ?? appointment.service,
            appointmentDateTime: appointment.dateTime,
            status: appointment.status,
        });
        this.realtime.emitToUser(user.id, "appointments:created", {
            appointmentId: appointment.id,
            dateTime: appointment.dateTime,
            status: appointment.status,
        });
        return {
            ...appointment,
            notificationRecipient: this.email.resolveBookingRecipient(appointment.user.email),
        };
    }
    async update(user, id, body) {
        await this.findOwned(user.id, id);
        const service = body.service
            ? await this.resolveActiveService(body.service)
            : null;
        const changed = await this.prisma.appointment.updateMany({
            where: { id, userId: user.id },
            data: {
                serviceId: body.service ? service?.id : undefined,
                service: body.service ? service?.name : undefined,
                notes: body.notes,
            },
        });
        if (changed.count !== 1) {
            throw new ConflictException("The appointment changed. Please retry.");
        }
        const updated = await this.findOwned(user.id, id);
        await this.email.sendBookingUpdate({
            to: updated.user.email,
            firstName: updated.user.firstName,
            appointmentDateTime: updated.dateTime,
            status: updated.status,
        });
        this.realtime.emitToUser(user.id, "appointments:updated", {
            appointmentId: updated.id,
            dateTime: updated.dateTime,
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
        try {
            await this.appointmentSlots.withAvailableSlot({
                dateTime: body.dateTime,
                durationMinutes: existing.serviceRef?.durationMinutes ?? 60,
                excludeAppointmentId: id,
                conflictMessage: "The requested time is not available.",
            }, async (transaction) => {
                const changed = await transaction.appointment.updateMany({
                    where: {
                        id,
                        userId: user.id,
                        status: { not: AppointmentStatus.Cancelled },
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
            });
        }
        catch (error) {
            this.rethrowSlotConflict(error, "The requested time is not available.");
        }
        const updated = await this.findOwned(user.id, id);
        await this.email.sendBookingUpdate({
            to: updated.user.email,
            firstName: updated.user.firstName,
            appointmentDateTime: updated.dateTime,
            status: updated.status,
        });
        this.realtime.emitToUser(user.id, "appointments:rescheduled", {
            appointmentId: updated.id,
            dateTime: updated.dateTime,
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
        const changed = await this.prisma.appointment.updateMany({
            where: {
                id,
                userId: user.id,
                status: { not: AppointmentStatus.Cancelled },
            },
            data: {
                status: AppointmentStatus.Confirmed,
                confirmedAt: new Date(),
            },
        });
        if (changed.count !== 1) {
            throw new ConflictException("The appointment state changed. Please retry.");
        }
        const updated = await this.findOwned(user.id, id);
        await this.email.sendBookingConfirmation({
            to: updated.user.email,
            firstName: updated.user.firstName,
            bookingId: updated.id,
            service: updated.serviceRef?.name ?? updated.service,
            appointmentDateTime: updated.dateTime,
            status: updated.status,
        });
        this.realtime.emitToUser(user.id, "appointments:confirmed", {
            appointmentId: updated.id,
            dateTime: updated.dateTime,
            status: updated.status,
        });
        return updated;
    }
    async cancel(user, id) {
        const existing = await this.findOwned(user.id, id);
        if (existing.status === AppointmentStatus.Cancelled) {
            return existing;
        }
        const changed = await this.prisma.appointment.updateMany({
            where: {
                id,
                userId: user.id,
                status: { not: AppointmentStatus.Cancelled },
            },
            data: {
                status: AppointmentStatus.Cancelled,
                cancelledAt: new Date(),
            },
        });
        if (changed.count !== 1) {
            throw new ConflictException("The appointment state changed. Please retry.");
        }
        const updated = await this.findOwned(user.id, id);
        await this.email.sendBookingCancellation({
            to: updated.user.email,
            firstName: updated.user.firstName,
            bookingId: updated.id,
            service: updated.serviceRef?.name ?? updated.service,
            appointmentDateTime: updated.dateTime,
            status: updated.status,
        });
        this.realtime.emitToUser(user.id, "appointments:cancelled", {
            appointmentId: updated.id,
            dateTime: updated.dateTime,
            status: updated.status,
        });
        return updated;
    }
    async delete(user, id, approvalToken) {
        this.assertDeletionApproved(approvalToken);
        const existing = await this.findOwned(user.id, id);
        if (!existing.deleteRequestedAt) {
            throw new BadRequestException("Deletion request not found.");
        }
        const deleted = await this.prisma.appointment.deleteMany({
            where: {
                id,
                userId: user.id,
                deleteRequestedAt: { not: null },
            },
        });
        if (deleted.count !== 1) {
            throw new ConflictException("The deletion request is no longer valid.");
        }
        await this.email.sendBookingCancellation({
            to: existing.user.email,
            firstName: existing.user.firstName,
            bookingId: existing.id,
            service: existing.serviceRef?.name ?? existing.service,
            appointmentDateTime: existing.dateTime,
            status: existing.status,
        });
        this.realtime.emitToUser(user.id, "appointments:deleted", {
            appointmentId: existing.id,
        });
        return { message: "Appointment deleted successfully" };
    }
    async requestDeletion(user, id) {
        const existing = await this.findOwned(user.id, id);
        if (existing.deleteRequestedAt) {
            return { message: "Deletion request already sent." };
        }
        const changed = await this.prisma.appointment.updateMany({
            where: { id, userId: user.id, deleteRequestedAt: null },
            data: { deleteRequestedAt: new Date() },
        });
        if (changed.count !== 1) {
            return { message: "Deletion request already sent." };
        }
        const updated = await this.findOwned(user.id, id);
        await this.email.sendDeletionRequest({
            to: updated.user.email,
            firstName: updated.user.firstName,
            bookingId: updated.id,
            service: updated.serviceRef?.name ?? updated.service,
            appointmentDateTime: updated.dateTime,
            status: updated.status,
        });
        this.realtime.emitToUser(user.id, "appointments:updated", {
            appointmentId: updated.id,
            dateTime: updated.dateTime,
            status: updated.status,
        });
        return { message: "Deletion request sent for approval." };
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
    async findOwned(userId, id) {
        const appointment = await this.prisma.appointment.findFirst({
            where: { id, userId },
            include: safeAppointmentInclude,
        });
        if (!appointment) {
            throw new NotFoundException("Appointment not found.");
        }
        return appointment;
    }
    assertDeletionApproved(approvalToken) {
        const expected = env.DELETE_APPROVAL_TOKEN.trim();
        if (!approvalToken?.trim() || !expected || approvalToken.trim() !== expected) {
            throw new ForbiddenException("Deletion approval required.");
        }
    }
    rethrowSlotConflict(error, message) {
        if (error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002") {
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
