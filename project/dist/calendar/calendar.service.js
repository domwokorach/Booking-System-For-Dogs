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
exports.CalendarService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
let CalendarService = class CalendarService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAvailableDates(serviceId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dates = [];
        for (let i = 0; i < 30; i += 1) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            dates.push(date.toISOString().slice(0, 10));
        }
        if (!serviceId) {
            return { availableDates: dates };
        }
        const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
        if (!service) {
            return { availableDates: [] };
        }
        return { availableDates: dates };
    }
    async getAvailableTimes(serviceId, date) {
        const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
        if (!service) {
            return { availableTimes: [] };
        }
        const dayStart = new Date(`${date}T00:00:00.000Z`);
        const dayEnd = new Date(`${date}T23:59:59.999Z`);
        const existingBookings = await this.prisma.booking.findMany({
            where: {
                serviceId,
                appointmentAt: {
                    gte: dayStart,
                    lte: dayEnd,
                },
                status: {
                    in: [client_1.BookingStatus.PENDING, client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.RESCHEDULED],
                },
            },
            select: {
                appointmentAt: true,
            },
        });
        const bookedTimeSet = new Set(existingBookings.map((booking) => booking.appointmentAt.toISOString().slice(11, 16)));
        const availableTimes = [];
        for (let hour = 9; hour <= 17; hour += 1) {
            for (const minute of [0, 30]) {
                const hh = String(hour).padStart(2, '0');
                const mm = String(minute).padStart(2, '0');
                const slot = `${hh}:${mm}`;
                if (!bookedTimeSet.has(slot)) {
                    availableTimes.push(slot);
                }
            }
        }
        return { availableTimes };
    }
};
exports.CalendarService = CalendarService;
exports.CalendarService = CalendarService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CalendarService);
