var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";
import { env } from "../config/env.js";
import { dateKeySchema } from "../common/validation/date-key.schema.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppointmentSlotsService } from "../scheduling/appointment-slots.service.js";
const slotsQuerySchema = z.object({
    serviceId: z.string().min(1),
    date: dateKeySchema,
});
function formatTime(value) {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: env.BUSINESS_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).format(value);
}
let SlotsService = class SlotsService {
    prisma;
    appointmentSlots;
    constructor(prisma, appointmentSlots) {
        this.prisma = prisma;
        this.appointmentSlots = appointmentSlots;
    }
    async list(query) {
        const { serviceId, date } = slotsQuerySchema.parse(query);
        const service = await this.prisma.service.findFirst({
            where: { id: serviceId, active: true },
            select: { id: true, durationMinutes: true },
        });
        if (!service) {
            throw new NotFoundException("Service not found.");
        }
        const availableTimes = await this.appointmentSlots.getAvailableTimes(date, service.durationMinutes);
        const slots = availableTimes.map((isoDateTime) => {
            const startAt = new Date(isoDateTime);
            const endAt = new Date(startAt.getTime() + service.durationMinutes * 60 * 1000);
            return {
                id: `${service.id}|${startAt.toISOString()}`,
                serviceId: service.id,
                date,
                time: formatTime(startAt),
                startAt: startAt.toISOString(),
                endAt: endAt.toISOString(),
                active: true,
            };
        });
        return { serviceId: service.id, date, slots };
    }
};
SlotsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService,
        AppointmentSlotsService])
], SlotsService);
export { SlotsService };
