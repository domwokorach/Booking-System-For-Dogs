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

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: env.BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(value);
}

@Injectable()
export class SlotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appointmentSlots: AppointmentSlotsService,
  ) {}

  async list(query: unknown) {
    const { serviceId, date } = slotsQuerySchema.parse(query);
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, active: true },
      select: { id: true, durationMinutes: true },
    });

    if (!service) {
      throw new NotFoundException("Service not found.");
    }

    const availableTimes = await this.appointmentSlots.getAvailableTimes(
      date,
      service.durationMinutes,
    );
    const slots = availableTimes.map((isoDateTime) => {
      const startAt = new Date(isoDateTime);
      const endAt = new Date(
        startAt.getTime() + service.durationMinutes * 60 * 1000,
      );

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
}
