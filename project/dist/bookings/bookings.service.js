"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
let BookingsService = class BookingsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createBooking(userId, dto) {
        await this.ensureServiceExists(dto.serviceId);
        const booking = await this.prisma.booking.create({
            data: {
                userId,
                serviceId: dto.serviceId,
                appointmentAt: new Date(dto.appointmentAt),
                notes: dto.notes,
            },
            include: {
                service: true,
            },
        });
        return {
            message: 'Booking created successfully.',
            booking,
        };
    }
    async viewBooking(userId, bookingId) {
        const booking = await this.findOwnedBookingOrThrow(userId, bookingId);
        return booking;
    }
    async listMyBookings(userId) {
        return this.prisma.booking.findMany({
            where: { userId },
            include: { service: true },
            orderBy: { appointmentAt: 'asc' },
        });
    }
    async confirmBooking(userId, bookingId) {
        await this.findOwnedBookingOrThrow(userId, bookingId);
        const booking = await this.prisma.booking.update({
            where: { id: bookingId },
            data: { status: client_1.BookingStatus.CONFIRMED },
            include: { service: true },
        });
        return {
            message: 'Booking confirmed successfully.',
            booking,
        };
    }
    async editBooking(userId, bookingId, dto) {
        await this.findOwnedBookingOrThrow(userId, bookingId);
        if (dto.serviceId) {
            await this.ensureServiceExists(dto.serviceId);
        }
        const booking = await this.prisma.booking.update({
            where: { id: bookingId },
            data: {
                ...(dto.serviceId ? { serviceId: dto.serviceId } : {}),
                ...(dto.appointmentAt ? { appointmentAt: new Date(dto.appointmentAt) } : {}),
                ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
            },
            include: { service: true },
        });
        return {
            message: 'Booking updated successfully.',
            booking,
        };
    }
    async rescheduleBooking(userId, bookingId, dto) {
        await this.findOwnedBookingOrThrow(userId, bookingId);
        const booking = await this.prisma.booking.update({
            where: { id: bookingId },
            data: {
                appointmentAt: new Date(dto.appointmentAt),
                status: client_1.BookingStatus.RESCHEDULED,
            },
            include: { service: true },
        });
        return {
            message: 'Booking rescheduled successfully.',
            booking,
        };
    }
    async changeBookingDate(userId, bookingId, dto) {
        const existing = await this.findOwnedBookingOrThrow(userId, bookingId);
        const current = existing.appointmentAt;
        const [year, month, day] = dto.appointmentDate.split('-').map(Number);
        const nextDate = new Date(current);
        nextDate.setUTCFullYear(year, month - 1, day);
        const booking = await this.prisma.booking.update({
            where: { id: bookingId },
            data: {
                appointmentAt: nextDate,
                status: client_1.BookingStatus.RESCHEDULED,
            },
            include: { service: true },
        });
        return {
            message: 'Booking date changed successfully.',
            booking,
        };
    }
    async changeBookingTime(userId, bookingId, dto) {
        const existing = await this.findOwnedBookingOrThrow(userId, bookingId);
        const current = existing.appointmentAt;
        const [hours, minutes] = dto.appointmentTime.split(':').map(Number);
        const nextDate = new Date(current);
        nextDate.setUTCHours(hours, minutes, 0, 0);
        const booking = await this.prisma.booking.update({
            where: { id: bookingId },
            data: {
                appointmentAt: nextDate,
                status: client_1.BookingStatus.RESCHEDULED,
            },
            include: { service: true },
        });
        return {
            message: 'Booking time changed successfully.',
            booking,
        };
    }
    async cancelBooking(userId, bookingId) {
        await this.findOwnedBookingOrThrow(userId, bookingId);
        const booking = await this.prisma.booking.update({
            where: { id: bookingId },
            data: { status: client_1.BookingStatus.CANCELLED },
            include: { service: true },
        });
        return {
            message: 'Booking cancelled successfully.',
            booking,
        };
    }
    async findOwnedBookingOrThrow(userId, bookingId) {
        const booking = await this.prisma.booking.findFirst({
            where: {
                id: bookingId,
                userId,
            },
            include: {
                service: true,
            },
        });
        if (!booking) {
            throw new common_1.NotFoundException('Booking not found.');
        }
        return booking;
    }
    async ensureServiceExists(serviceId) {
        const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
        if (!service) {
            throw new common_1.BadRequestException('Service not found.');
        }
    }
};
exports.BookingsService = BookingsService;
exports.BookingsService = BookingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BookingsService);
