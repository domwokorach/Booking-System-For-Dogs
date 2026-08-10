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
import { parseSlotId, toApiStatus, toBookingDto, toBookingMutationResponse, } from "./booking-mappers.js";
const bookingUserSelect = {
    id: true,
    firstName: true,
    surname: true,
    email: true,
    address: true,
    mobileNumber: true,
};
let BookingsService = class BookingsService {
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
    async createAndConfirm(user, body) {
        const slot = parseSlotId(body.slotId);
        if (slot.serviceId !== body.serviceId) {
            throw new BadRequestException("Slot does not match selected service.");
        }
        const service = await this.resolveActiveService(body.serviceId);
        let appointment;
        try {
            appointment = await this.appointmentSlots.withAvailableSlot({
                dateTime: slot.dateTime,
                durationMinutes: service.durationMinutes,
                conflictMessage: "Sorry, this appointment has already been booked.",
            }, (transaction) => transaction.appointment.create({
                data: {
                    userId: user.id,
                    dateTime: slot.dateTime,
                    serviceId: service.id,
                    service: service.name,
                    status: AppointmentStatus.Confirmed,
                    confirmedAt: new Date(),
                },
                include: { user: { select: bookingUserSelect } },
            }));
        }
        catch (error) {
            this.rethrowSlotConflict(error);
        }
        await this.email.sendBookingConfirmation({
            to: appointment.user.email,
            firstName: appointment.user.firstName,
            bookingId: appointment.id,
            service: appointment.service,
            appointmentDateTime: appointment.dateTime,
            status: toApiStatus(appointment.status),
        });
        this.realtime.emitToUser(user.id, "appointments:created", {
            appointmentId: appointment.id,
            dateTime: appointment.dateTime,
            status: appointment.status,
        });
        return toBookingMutationResponse(appointment, "Appointment confirmed successfully");
    }
    async listMine(user) {
        const appointments = await this.prisma.appointment.findMany({
            where: { userId: user.id },
            orderBy: { dateTime: "asc" },
            include: { serviceRef: { select: { name: true } } },
        });
        return { bookings: appointments.map(toBookingDto) };
    }
    async getOne(user, id) {
        const appointment = await this.prisma.appointment.findFirst({
            where: { id, userId: user.id },
            include: { serviceRef: { select: { name: true } } },
        });
        if (!appointment) {
            throw new NotFoundException("Booking not found.");
        }
        return { booking: toBookingDto(appointment) };
    }
    async confirm(user, id) {
        const existing = await this.findOwnedWithUser(user.id, id);
        if (existing.status === AppointmentStatus.Cancelled) {
            throw new BadRequestException("Cancelled appointments cannot be confirmed.");
        }
        if (existing.status === AppointmentStatus.Confirmed) {
            return toBookingMutationResponse(existing, "Appointment confirmed successfully");
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
            throw new ConflictException("The booking state changed. Please retry.");
        }
        const updated = await this.findOwnedWithUser(user.id, id);
        await this.email.sendBookingConfirmation({
            to: updated.user.email,
            firstName: updated.user.firstName,
            bookingId: updated.id,
            service: updated.service,
            appointmentDateTime: updated.dateTime,
            status: toApiStatus(updated.status),
        });
        this.realtime.emitToUser(user.id, "appointments:confirmed", {
            appointmentId: updated.id,
            dateTime: updated.dateTime,
            status: updated.status,
        });
        return toBookingMutationResponse(updated, "Appointment confirmed successfully");
    }
    async reschedule(user, id, body) {
        const slot = parseSlotId(body.slotId);
        const service = await this.resolveActiveService(slot.serviceId);
        const existing = await this.findOwnedWithUser(user.id, id);
        if (existing.status === AppointmentStatus.Cancelled) {
            throw new BadRequestException("Cancelled bookings cannot be rescheduled.");
        }
        try {
            await this.appointmentSlots.withAvailableSlot({
                dateTime: slot.dateTime,
                durationMinutes: service.durationMinutes,
                excludeAppointmentId: id,
                conflictMessage: "Sorry, this appointment has already been booked.",
            }, async (transaction) => {
                const changed = await transaction.appointment.updateMany({
                    where: {
                        id,
                        userId: user.id,
                        status: { not: AppointmentStatus.Cancelled },
                    },
                    data: {
                        dateTime: slot.dateTime,
                        serviceId: service.id,
                        service: service.name,
                        status: AppointmentStatus.Rescheduled,
                        rescheduledFrom: existing.dateTime,
                    },
                });
                if (changed.count !== 1) {
                    throw new ConflictException("The booking state changed. Please retry.");
                }
            });
        }
        catch (error) {
            this.rethrowSlotConflict(error);
        }
        const updated = await this.findOwnedWithUser(user.id, id);
        await this.email.sendBookingUpdate({
            to: updated.user.email,
            firstName: updated.user.firstName,
            appointmentDateTime: updated.dateTime,
            status: toApiStatus(updated.status),
        });
        this.realtime.emitToUser(user.id, "appointments:rescheduled", {
            appointmentId: updated.id,
            dateTime: updated.dateTime,
            status: updated.status,
        });
        return toBookingMutationResponse(updated, "Appointment rescheduled successfully");
    }
    async cancel(user, id) {
        const existing = await this.findOwnedWithUser(user.id, id);
        if (existing.status === AppointmentStatus.Cancelled) {
            return toBookingMutationResponse(existing, "Appointment cancelled successfully");
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
            throw new ConflictException("The booking state changed. Please retry.");
        }
        const updated = await this.findOwnedWithUser(user.id, id);
        await this.email.sendBookingCancellation({
            to: updated.user.email,
            firstName: updated.user.firstName,
            bookingId: updated.id,
            service: updated.service,
            appointmentDateTime: updated.dateTime,
            status: toApiStatus(updated.status),
        });
        this.realtime.emitToUser(user.id, "appointments:cancelled", {
            appointmentId: updated.id,
            dateTime: updated.dateTime,
            status: updated.status,
        });
        return toBookingMutationResponse(updated, "Appointment cancelled successfully");
    }
    async delete(user, id, approvalToken) {
        this.assertDeletionApproved(approvalToken);
        const existing = await this.findOwnedWithUser(user.id, id);
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
            service: existing.service,
            appointmentDateTime: existing.dateTime,
            status: toApiStatus(existing.status),
        });
        this.realtime.emitToUser(user.id, "appointments:deleted", {
            appointmentId: existing.id,
        });
        return {
            success: true,
            bookingId: existing.id,
            message: "Appointment deleted successfully",
        };
    }
    async requestDeletion(user, id) {
        const existing = await this.findOwnedWithUser(user.id, id);
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
        const updated = await this.findOwnedWithUser(user.id, id);
        await this.email.sendDeletionRequest({
            to: updated.user.email,
            firstName: updated.user.firstName,
            bookingId: updated.id,
            service: updated.service,
            appointmentDateTime: updated.dateTime,
            status: toApiStatus(updated.status),
        });
        this.realtime.emitToUser(user.id, "appointments:updated", {
            appointmentId: updated.id,
            dateTime: updated.dateTime,
            status: updated.status,
        });
        return {
            success: true,
            bookingId: updated.id,
            status: toApiStatus(updated.status),
            message: "Deletion request sent for approval",
        };
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
    async findOwnedWithUser(userId, id) {
        const appointment = await this.prisma.appointment.findFirst({
            where: { id, userId },
            include: { user: { select: bookingUserSelect } },
        });
        if (!appointment) {
            throw new NotFoundException("Booking not found.");
        }
        return appointment;
    }
    assertDeletionApproved(approvalToken) {
        const expected = env.DELETE_APPROVAL_TOKEN.trim();
        if (!approvalToken?.trim() || !expected || approvalToken.trim() !== expected) {
            throw new ForbiddenException("Deletion approval required.");
        }
    }
    rethrowSlotConflict(error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002") {
            throw new ConflictException("Sorry, this appointment has already been booked.");
        }
        throw error;
    }
};
BookingsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService,
        AppointmentSlotsService,
        EmailService,
        RealtimeGateway])
], BookingsService);
export { BookingsService };
