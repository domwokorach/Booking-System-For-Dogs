import { ConflictException, Injectable } from "@nestjs/common";
import { AppointmentStatus, Prisma } from "@prisma/client";

import { env } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.Pending,
  AppointmentStatus.Confirmed,
  AppointmentStatus.Rescheduled,
];
const BUSINESS_HOURS = Array.from({ length: 9 }, (_, index) => 9 + index);

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
};

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

function getZonedParts(value: Date): ZonedParts {
  const parts = Object.fromEntries(
    businessDateTimeFormatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

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

function toDateKey(parts: Pick<ZonedParts, "year" | "month" | "day">): string {
  return `${parts.year.toString().padStart(4, "0")}-${parts.month
    .toString()
    .padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

function createBusinessDateTime(dateKey: string, hour: number): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
  let instant = desiredAsUtc;

  // Convert a wall-clock time in the configured IANA zone to an instant.
  // Repeating handles daylight-saving offsets without relying on host TZ.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const rendered = getZonedParts(new Date(instant));
    const renderedAsUtc = Date.UTC(
      rendered.year,
      rendered.month - 1,
      rendered.day,
      rendered.hour,
      rendered.minute,
      rendered.second,
    );
    instant += desiredAsUtc - renderedAsUtc;
  }

  return new Date(instant);
}

function isSunday(dateKey: string): boolean {
  return getZonedParts(createBusinessDateTime(dateKey, 12)).weekday === "Sun";
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

function getCoveredDateKeys(start: Date, end: Date): string[] {
  const first = toDateKey(getZonedParts(start));
  const last = toDateKey(getZonedParts(new Date(end.getTime() - 1)));
  const keys: string[] = [];

  for (let current = first; current <= last; current = addDaysToDateKey(current, 1)) {
    keys.push(current);
  }

  return keys;
}

function overlaps(
  start: Date,
  durationMinutes: number,
  existingStart: Date,
  existingDurationMinutes: number,
): boolean {
  const end = start.getTime() + durationMinutes * 60_000;
  const existingEnd =
    existingStart.getTime() + existingDurationMinutes * 60_000;
  return start.getTime() < existingEnd && end > existingStart.getTime();
}

type SlotClaimInput = {
  dateTime: Date;
  durationMinutes: number;
  excludeAppointmentId?: string;
  conflictMessage: string;
};

@Injectable()
export class AppointmentSlotsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailableTimes(
    date: Date | string,
    durationMinutes = 60,
  ): Promise<string[]> {
    const dateKey =
      typeof date === "string" ? date : date.toISOString().slice(0, 10);

    if (isSunday(dateKey)) {
      return [];
    }

    const allSlots = BUSINESS_HOURS.map((hour) =>
      createBusinessDateTime(dateKey, hour),
    );
    const maximumDuration = await this.getMaximumServiceDuration();
    const scanStart = new Date(
      allSlots[0].getTime() - maximumDuration * 60_000,
    );
    const scanEnd = new Date(
      allSlots.at(-1)!.getTime() + durationMinutes * 60_000,
    );
    const appointments = await this.prisma.appointment.findMany({
      where: {
        dateTime: { gte: scanStart, lt: scanEnd },
        status: { in: ACTIVE_APPOINTMENT_STATUSES },
      },
      select: {
        dateTime: true,
        serviceRef: { select: { durationMinutes: true } },
      },
    });
    const now = Date.now();

    return allSlots
      .filter(
        (slot) =>
          slot.getTime() > now &&
          !appointments.some((appointment) =>
            overlaps(
              slot,
              durationMinutes,
              appointment.dateTime,
              appointment.serviceRef?.durationMinutes ?? maximumDuration,
            ),
          ),
      )
      .map((slot) => slot.toISOString());
  }

  async isAvailable(
    dateTime: Date,
    excludeAppointmentId?: string,
    durationMinutes = 60,
  ): Promise<boolean> {
    if (!this.isBookableSlot(dateTime)) {
      return false;
    }

    const maximumDuration = await this.getMaximumServiceDuration();
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
        serviceRef: { select: { durationMinutes: true } },
      },
    });

    return !existing.some((appointment) =>
      overlaps(
        dateTime,
        durationMinutes,
        appointment.dateTime,
        appointment.serviceRef?.durationMinutes ?? maximumDuration,
      ),
    );
  }

  async withAvailableSlot<T>(
    input: SlotClaimInput,
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!this.isBookableSlot(input.dateTime)) {
      throw new ConflictException(input.conflictMessage);
    }

    const requestedEnd = new Date(
      input.dateTime.getTime() + input.durationMinutes * 60_000,
    );
    const lockKeys = getCoveredDateKeys(input.dateTime, requestedEnd);

    return this.prisma.$transaction(async (transaction) => {
      // Always lock covered business dates in ascending order to avoid
      // deadlocks when long services span multiple calendar days.
      for (const dateKey of lockKeys) {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${`appointment-slots:${dateKey}`}))
        `;
      }

      const maximumDuration = await this.getMaximumServiceDuration(transaction);
      const appointments = await transaction.appointment.findMany({
        where: {
          id: input.excludeAppointmentId
            ? { not: input.excludeAppointmentId }
            : undefined,
          dateTime: {
            gte: new Date(
              input.dateTime.getTime() - maximumDuration * 60_000,
            ),
            lt: requestedEnd,
          },
          status: { in: ACTIVE_APPOINTMENT_STATUSES },
        },
        select: {
          dateTime: true,
          serviceRef: { select: { durationMinutes: true } },
        },
      });

      const unavailable = appointments.some((appointment) =>
        overlaps(
          input.dateTime,
          input.durationMinutes,
          appointment.dateTime,
          appointment.serviceRef?.durationMinutes ?? maximumDuration,
        ),
      );
      if (unavailable) {
        throw new ConflictException(input.conflictMessage);
      }

      return operation(transaction);
    });
  }

  private isBookableSlot(dateTime: Date): boolean {
    if (
      Number.isNaN(dateTime.getTime()) ||
      dateTime.getTime() <= Date.now() ||
      dateTime.getUTCSeconds() !== 0 ||
      dateTime.getUTCMilliseconds() !== 0
    ) {
      return false;
    }

    const parts = getZonedParts(dateTime);
    if (
      parts.weekday === "Sun" ||
      parts.minute !== 0 ||
      !BUSINESS_HOURS.includes(parts.hour)
    ) {
      return false;
    }

    const expected = createBusinessDateTime(toDateKey(parts), parts.hour);
    return expected.getTime() === dateTime.getTime();
  }

  private async getMaximumServiceDuration(
    transaction?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = transaction ?? this.prisma;
    const result = await client.service.aggregate({
      _max: { durationMinutes: true },
    });
    return Math.max(result._max.durationMinutes ?? 60, 60);
  }
}
