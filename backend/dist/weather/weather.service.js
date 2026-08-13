var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable, ServiceUnavailableException, } from "@nestjs/common";
import { AppointmentStatus } from "@prisma/client";
import { z } from "zod";
import { env } from "../config/env.js";
import { EmailService } from "../notifications/email.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { evaluateWeatherSafety } from "./weather-policy.js";
const WEATHER_STATE_ID = "pawside";
const EMAIL_RETRY_DELAY_MS = 15 * 60_000;
const ACTIVE_APPOINTMENT_STATUSES = [
    AppointmentStatus.Pending,
    AppointmentStatus.Confirmed,
    AppointmentStatus.Rescheduled,
    AppointmentStatus.CancellationPending,
];
const openWeatherResponseSchema = z.object({
    main: z.object({
        temp: z.number(),
        feels_like: z.number().optional(),
        humidity: z.number().int().optional(),
    }),
    weather: z
        .array(z.object({
        description: z.string(),
    }))
        .default([]),
    dt: z.number(),
});
const businessDateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: env.BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});
function businessDateKey(value) {
    const parts = Object.fromEntries(businessDateFormatter
        .formatToParts(value)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}
function addDays(dateKey, days) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day + days))
        .toISOString()
        .slice(0, 10);
}
function createBusinessMidnight(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const desiredAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    let instant = desiredAsUtc;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
            timeZone: env.BUSINESS_TIME_ZONE,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hourCycle: "h23",
        })
            .formatToParts(new Date(instant))
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, part.value]));
        const renderedAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
        instant += desiredAsUtc - renderedAsUtc;
    }
    return new Date(instant);
}
let WeatherService = class WeatherService {
    prisma;
    email;
    refreshTimer = null;
    constructor(prisma, email) {
        this.prisma = prisma;
        this.email = email;
    }
    onModuleInit() {
        void this.refreshInBackground();
        this.refreshTimer = setInterval(() => void this.refreshInBackground(), env.WEATHER_CACHE_MINUTES * 60_000);
        this.refreshTimer.unref();
    }
    onModuleDestroy() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
    async getCurrentWeather(forceRefresh = false) {
        const cached = await this.prisma.weatherSafetyState.findUnique({
            where: { id: WEATHER_STATE_ID },
        });
        const cacheLifetime = env.WEATHER_CACHE_MINUTES * 60_000;
        if (!forceRefresh &&
            cached &&
            Date.now() - cached.checkedAt.getTime() < cacheLifetime) {
            if (cached.temperatureC >= 30 && cached.alertStartedAt) {
                await this.notifyAffectedCustomers(cached);
            }
            else if (!cached.bookingBlocked &&
                cached.safetyRestoredAt &&
                cached.restoredAlertStartedAt) {
                await this.notifySafetyRestored(cached);
            }
            return this.toResponse(cached, false);
        }
        try {
            const current = await this.fetchCurrentWeather();
            const checkedAt = new Date();
            const saved = await this.prisma.$transaction(async (transaction) => {
                await transaction.$executeRaw `
          SELECT pg_advisory_xact_lock(hashtext('pawside-weather-safety'))
        `;
                const previous = await transaction.weatherSafetyState.findUnique({
                    where: { id: WEATHER_STATE_ID },
                });
                const decision = evaluateWeatherSafety(current.temperatureC, previous?.bookingBlocked ?? false);
                const safetyWasRestored = Boolean(previous?.bookingBlocked &&
                    !decision.bookingBlocked &&
                    previous.alertStartedAt);
                const alertStartedAt = decision.heatWarning
                    ? previous?.alertStartedAt ?? checkedAt
                    : decision.bookingBlocked
                        ? previous?.alertStartedAt ?? null
                        : null;
                const safetyRestoredAt = decision.heatWarning
                    ? null
                    : safetyWasRestored
                        ? checkedAt
                        : previous?.safetyRestoredAt ?? null;
                const restoredAlertStartedAt = decision.heatWarning
                    ? null
                    : safetyWasRestored
                        ? previous?.alertStartedAt ?? null
                        : previous?.restoredAlertStartedAt ?? null;
                return transaction.weatherSafetyState.upsert({
                    where: { id: WEATHER_STATE_ID },
                    create: {
                        id: WEATHER_STATE_ID,
                        ...current,
                        bookingBlocked: decision.bookingBlocked,
                        alertStartedAt,
                        safetyRestoredAt,
                        restoredAlertStartedAt,
                        checkedAt,
                    },
                    update: {
                        ...current,
                        bookingBlocked: decision.bookingBlocked,
                        alertStartedAt,
                        safetyRestoredAt,
                        restoredAlertStartedAt,
                        checkedAt,
                    },
                });
            });
            if (saved.temperatureC >= 30 && saved.alertStartedAt) {
                await this.notifyAffectedCustomers(saved);
            }
            else if (!saved.bookingBlocked &&
                saved.safetyRestoredAt &&
                saved.restoredAlertStartedAt) {
                await this.notifySafetyRestored(saved);
            }
            return this.toResponse(saved, false);
        }
        catch (error) {
            if (cached) {
                console.warn("Weather refresh failed. Using the last known conditions.");
                return this.toResponse(cached, true);
            }
            if (error instanceof ServiceUnavailableException) {
                throw error;
            }
            console.error("Unable to load current weather.", error);
            throw new ServiceUnavailableException("Current weather information is temporarily unavailable.");
        }
    }
    async isBookingBlocked() {
        try {
            const weather = await this.getCurrentWeather();
            return weather.bookingBlocked;
        }
        catch {
            // A provider outage must not silently erase existing appointment access.
            const lastKnown = await this.prisma.weatherSafetyState.findUnique({
                where: { id: WEATHER_STATE_ID },
                select: { bookingBlocked: true },
            });
            return lastKnown?.bookingBlocked ?? false;
        }
    }
    refreshNow() {
        return this.getCurrentWeather(true);
    }
    async fetchCurrentWeather() {
        const apiKey = env.WEATHER_API.trim();
        if (!apiKey) {
            throw new ServiceUnavailableException("WEATHER_API is not configured on the backend.");
        }
        const url = new URL("https://api.openweathermap.org/data/2.5/weather");
        url.searchParams.set("lat", String(env.WEATHER_LAT));
        url.searchParams.set("lon", String(env.WEATHER_LON));
        url.searchParams.set("units", "metric");
        url.searchParams.set("appid", apiKey);
        const response = await fetch(url, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) {
            throw new ServiceUnavailableException(`Weather provider returned status ${response.status}.`);
        }
        const parsed = openWeatherResponseSchema.parse(await response.json());
        return {
            location: env.WEATHER_LOCATION,
            temperatureC: parsed.main.temp,
            feelsLikeC: parsed.main.feels_like ?? null,
            humidity: parsed.main.humidity ?? null,
            condition: parsed.weather[0]?.description ?? null,
            bookingBlocked: false,
            alertStartedAt: null,
            safetyRestoredAt: null,
            restoredAlertStartedAt: null,
            weatherObservedAt: new Date(parsed.dt * 1000),
            checkedAt: new Date(),
        };
    }
    async refreshInBackground() {
        try {
            await this.refreshNow();
        }
        catch (error) {
            console.error("Background weather refresh failed.", error);
        }
    }
    toResponse(state, stale) {
        const decision = evaluateWeatherSafety(state.temperatureC, state.bookingBlocked);
        return {
            location: state.location,
            timeZone: env.BUSINESS_TIME_ZONE,
            currentLocalTime: new Intl.DateTimeFormat("en-GB", {
                timeZone: env.BUSINESS_TIME_ZONE,
                dateStyle: "medium",
                timeStyle: "short",
            }).format(new Date()),
            temperatureC: state.temperatureC,
            feelsLikeC: state.feelsLikeC,
            humidity: state.humidity,
            condition: state.condition,
            safetyLevel: decision.safetyLevel,
            heatWarning: decision.heatWarning,
            bookingBlocked: state.bookingBlocked,
            alertStartedAt: state.alertStartedAt?.toISOString() ?? null,
            safetyRestoredAt: state.safetyRestoredAt?.toISOString() ?? null,
            observedAt: state.weatherObservedAt.toISOString(),
            checkedAt: state.checkedAt.toISOString(),
            stale,
        };
    }
    async notifyAffectedCustomers(state) {
        if (!state.alertStartedAt) {
            return;
        }
        const now = new Date();
        const tomorrow = createBusinessMidnight(addDays(businessDateKey(now), 1));
        const customers = await this.prisma.user.findMany({
            where: {
                appointments: {
                    some: {
                        dateTime: { gte: now, lt: tomorrow },
                        status: { in: ACTIVE_APPOINTMENT_STATUSES },
                    },
                },
            },
            select: { id: true, firstName: true, email: true },
        });
        await Promise.allSettled(customers.map(async (customer) => {
            const notification = await this.prisma.weatherAlertNotification.upsert({
                where: {
                    userId_alertStartedAt: {
                        userId: customer.id,
                        alertStartedAt: state.alertStartedAt,
                    },
                },
                update: { temperatureC: state.temperatureC },
                create: {
                    userId: customer.id,
                    alertStartedAt: state.alertStartedAt,
                    temperatureC: state.temperatureC,
                },
            });
            if (notification.deliveredAt) {
                return;
            }
            const claimedAt = new Date();
            const retryBefore = new Date(claimedAt.getTime() - EMAIL_RETRY_DELAY_MS);
            const claimed = await this.prisma.weatherAlertNotification.updateMany({
                where: {
                    id: notification.id,
                    deliveredAt: null,
                    OR: [
                        { lastAttemptedAt: null },
                        { lastAttemptedAt: { lt: retryBefore } },
                    ],
                },
                data: { lastAttemptedAt: claimedAt },
            });
            if (claimed.count === 0) {
                return;
            }
            const delivered = await this.email.sendHeatWarning({
                to: customer.email,
                firstName: customer.firstName,
                location: state.location,
                temperatureC: state.temperatureC,
            });
            if (delivered) {
                await this.prisma.weatherAlertNotification.update({
                    where: { id: notification.id },
                    data: { deliveredAt: new Date() },
                });
            }
        }));
    }
    async notifySafetyRestored(state) {
        if (!state.restoredAlertStartedAt) {
            return;
        }
        const notifications = await this.prisma.weatherAlertNotification.findMany({
            where: {
                alertStartedAt: state.restoredAlertStartedAt,
                deliveredAt: { not: null },
                safetyRestoredDeliveredAt: null,
            },
            select: {
                id: true,
                safetyRestoredLastAttemptedAt: true,
                user: { select: { firstName: true, email: true } },
            },
        });
        await Promise.allSettled(notifications.map(async (notification) => {
            const claimedAt = new Date();
            const retryBefore = new Date(claimedAt.getTime() - EMAIL_RETRY_DELAY_MS);
            const claimed = await this.prisma.weatherAlertNotification.updateMany({
                where: {
                    id: notification.id,
                    safetyRestoredDeliveredAt: null,
                    OR: [
                        { safetyRestoredLastAttemptedAt: null },
                        { safetyRestoredLastAttemptedAt: { lt: retryBefore } },
                    ],
                },
                data: { safetyRestoredLastAttemptedAt: claimedAt },
            });
            if (claimed.count === 0) {
                return;
            }
            const delivered = await this.email.sendSafeConditionsRestored({
                to: notification.user.email,
                firstName: notification.user.firstName,
                location: state.location,
                temperatureC: state.temperatureC,
            });
            if (delivered) {
                await this.prisma.weatherAlertNotification.update({
                    where: { id: notification.id },
                    data: { safetyRestoredDeliveredAt: new Date() },
                });
            }
        }));
    }
};
WeatherService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService,
        EmailService])
], WeatherService);
export { WeatherService };
