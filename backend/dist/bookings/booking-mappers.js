import { BadRequestException } from "@nestjs/common";
import { env } from "../config/env.js";
export function parseSlotId(slotId) {
    const separatorIndex = slotId.indexOf("|");
    const serviceId = slotId.slice(0, separatorIndex);
    const isoDateTime = slotId.slice(separatorIndex + 1);
    if (separatorIndex < 1 || !isoDateTime) {
        throw new BadRequestException("Invalid slot id.");
    }
    const dateTime = new Date(isoDateTime);
    if (Number.isNaN(dateTime.getTime())) {
        throw new BadRequestException("Invalid slot date/time.");
    }
    return { serviceId, dateTime };
}
export function toApiStatus(status) {
    return status.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}
export function formatDate(value) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
        timeZone: env.BUSINESS_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    })
        .formatToParts(value)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}
export function formatTime(value) {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: env.BUSINESS_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).format(value);
}
export function toBookingDto(appointment) {
    return {
        id: appointment.id,
        service: appointment.serviceRef?.name ?? appointment.service,
        appointmentDate: formatDate(appointment.dateTime),
        appointmentTime: formatTime(appointment.dateTime),
        status: toApiStatus(appointment.status),
        notes: appointment.notes,
        createdAt: appointment.createdAt.toISOString(),
        updatedAt: appointment.updatedAt.toISOString(),
    };
}
export function toBookingMutationResponse(appointment, message) {
    return {
        success: true,
        bookingId: appointment.id,
        status: toApiStatus(appointment.status),
        appointmentDate: formatDate(appointment.dateTime),
        appointmentTime: formatTime(appointment.dateTime),
        message,
    };
}
