var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ConflictException, Injectable } from "@nestjs/common";
import { AppointmentStatus } from "@prisma/client";
import { env } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { WeatherService } from "../weather/weather.service.js";
const ACTIVE_APPOINTMENT_STATUSES = [
    AppointmentStatus.Pending,
    AppointmentStatus.Confirmed,
    AppointmentStatus.Rescheduled,
    AppointmentStatus.CancellationPending,
];
const BUSINESS_HOURS = Array.from({ length: 9 }, (_, index) => 9 + index);
const businessDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: env.BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
});
function getZonedParts(value) {
    const parts = Object.fromEntries(businessDateTimeFormatter
        .formatToParts(value)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]));
    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        hour: Number(parts.hour),
        minute: Number(parts.minute),
        second: Number(parts.second),
        weekday: parts.weekday,
    };
}
function toDateKey(parts) {
    return `${parts.year.toString().padStart(4, "0")}-${parts.month
        .toString()
        .padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}
function createBusinessDateTime(dateKey, hour) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
    let instant = desiredAsUtc;
    // Convert a wall-clock time in the configured IANA zone to an instant.
    // Repeating handles daylight-saving offsets without relying on host TZ.
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const rendered = getZonedParts(new Date(instant));
        const renderedAsUtc = Date.UTC(rendered.year, rendered.month - 1, rendered.day, rendered.hour, rendered.minute, rendered.second);
        instant += desiredAsUtc - renderedAsUtc;
    }
    return new Date(instant);
}
function isSunday(dateKey) {
    return getZonedParts(createBusinessDateTime(dateKey, 12)).weekday === "Sun";
}
function addDaysToDateKey(dateKey, days) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const value = new Date(Date.UTC(year, month - 1, day + days));
    return value.toISOString().slice(0, 10);
}
function getCoveredDateKeys(start, end) {
    const first = toDateKey(getZonedParts(start));
    const last = toDateKey(getZonedParts(new Date(end.getTime() - 1)));
    const keys = [];
    for (let current = first; current <= last; current = addDaysToDateKey(current, 1)) {
        keys.push(current);
    }
    return keys;
}
function overlaps(start, durationMinutes, existingStart, existingDurationMinutes) {
    const end = start.getTime() + durationMinutes * 60_000;
    const existingEnd = existingStart.getTime() + existingDurationMinutes * 60_000;
    return start.getTime() < existingEnd && end > existingStart.getTime();
}
let AppointmentSlotsService = class AppointmentSlotsService {
    prisma;
    weather;
    constructor(prisma, weather) {
        this.prisma = prisma;
        this.weather = weather;
    }
    async getAvailableTimes(date, durationMinutes = 60, excludeAppointmentId) {
        if (await this.weather.isBookingBlocked()) {
            return [];
        }
        const dateKey = typeof date === "string" ? date : date.toISOString().slice(0, 10);
        if (isSunday(dateKey)) {
            return [];
        }
        const allSlots = BUSINESS_HOURS.map((hour) => createBusinessDateTime(dateKey, hour));
        const maximumDuration = await this.getMaximumDuration();
        const scanStart = new Date(allSlots[0].getTime() - maximumDuration * 60_000);
        const scanEnd = new Date(allSlots.at(-1).getTime() + durationMinutes * 60_000);
        const appointments = await this.prisma.appointment.findMany({
            where: {
                id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
                dateTime: { gte: scanStart, lt: scanEnd },
                status: { in: ACTIVE_APPOINTMENT_STATUSES },
            },
            select: {
                dateTime: true,
                durationMinutes: true,
            },
        });
        const now = Date.now();
        return allSlots
            .filter((slot) => slot.getTime() > now &&
            !appointments.some((appointment) => overlaps(slot, durationMinutes, appointment.dateTime, appointment.durationMinutes)))
            .map((slot) => slot.toISOString());
    }
    async isAvailable(dateTime, excludeAppointmentId, durationMinutes = 60) {
        if (await this.weather.isBookingBlocked()) {
            return false;
        }
        if (!this.isBookableSlot(dateTime)) {
            return false;
        }
        const maximumDuration = await this.getMaximumDuration();
        const existing = await this.prisma.appointment.findMany({
            where: {
                id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
                dateTime: {
                    gte: new Date(dateTime.getTime() - maximumDuration * 60_000),
                    lt: new Date(dateTime.getTime() + durationMinutes * 60_000),
                },
                status: { in: ACTIVE_APPOINTMENT_STATUSES },
            },
            select: {
                dateTime: true,
                durationMinutes: true,
            },
        });
        return !existing.some((appointment) => overlaps(dateTime, durationMinutes, appointment.dateTime, appointment.durationMinutes));
    }
    async withAvailableSlot(input, operation) {
        if (await this.weather.isBookingBlocked()) {
            throw new ConflictException("Appointments are temporarily unavailable because of the high temperature. Booking will reopen after the temperature falls below 25°C.");
        }
        if (!this.isBookableSlot(input.dateTime)) {
            throw new ConflictException(input.conflictMessage);
        }
        const requestedEnd = new Date(input.dateTime.getTime() + input.durationMinutes * 60_000);
        const lockKeys = getCoveredDateKeys(input.dateTime, requestedEnd);
        return this.prisma.$transaction(async (transaction) => {
            // Always lock covered business dates in ascending order to avoid
            // deadlocks when long services span multiple calendar days.
            for (const dateKey of lockKeys) {
                await transaction.$executeRaw `
          SELECT pg_advisory_xact_lock(hashtext(${`appointment-slots:${dateKey}`}))
        `;
            }
            const maximumDuration = await this.getMaximumDuration(transaction);
            const appointments = await transaction.appointment.findMany({
                where: {
                    id: input.excludeAppointmentId
                        ? { not: input.excludeAppointmentId }
                        : undefined,
                    dateTime: {
                        gte: new Date(input.dateTime.getTime() - maximumDuration * 60_000),
                        lt: requestedEnd,
                    },
                    status: { in: ACTIVE_APPOINTMENT_STATUSES },
                },
                select: {
                    dateTime: true,
                    durationMinutes: true,
                },
            });
            const unavailable = appointments.some((appointment) => overlaps(input.dateTime, input.durationMinutes, appointment.dateTime, appointment.durationMinutes));
            if (unavailable) {
                throw new ConflictException(input.conflictMessage);
            }
            return operation(transaction);
        });
    }
    isBookableSlot(dateTime) {
        if (Number.isNaN(dateTime.getTime()) ||
            dateTime.getTime() <= Date.now() ||
            dateTime.getUTCSeconds() !== 0 ||
            dateTime.getUTCMilliseconds() !== 0) {
            return false;
        }
        const parts = getZonedParts(dateTime);
        if (parts.weekday === "Sun" ||
            parts.minute !== 0 ||
            !BUSINESS_HOURS.includes(parts.hour)) {
            return false;
        }
        const expected = createBusinessDateTime(toDateKey(parts), parts.hour);
        return expected.getTime() === dateTime.getTime();
    }
    async getMaximumDuration(transaction) {
        const client = transaction ?? this.prisma;
        const serviceResult = await client.service.aggregate({
            _max: { durationMinutes: true },
        });
        const appointmentResult = await client.appointment.aggregate({
            where: { status: { in: ACTIVE_APPOINTMENT_STATUSES } },
            _max: { durationMinutes: true },
        });
        return Math.max(serviceResult._max.durationMinutes ?? 60, appointmentResult._max.durationMinutes ?? 60, 60);
    }
};
AppointmentSlotsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService,
        WeatherService])
], AppointmentSlotsService);
export { AppointmentSlotsService };
