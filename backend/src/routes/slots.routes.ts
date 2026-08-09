import { Router } from "express";
import { z } from "zod";

import { prisma } from "../config/prisma.js";
import { getAvailableAppointmentTimes } from "../utils/appointment-slots.js";
import { HttpError } from "../utils/http-error.js";

const router = Router();

const slotsQuerySchema = z.object({
  serviceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatTime(value: Date) {
  return value.toISOString().slice(11, 16);
}

router.get("/", async (req, res, next) => {
  try {
    const { serviceId, date } = slotsQuerySchema.parse(req.query);
    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        active: true,
      },
      select: {
        id: true,
        durationMinutes: true,
      },
    });

    if (!service) {
      throw new HttpError(404, "Service not found.");
    }

    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    const availableTimes = await getAvailableAppointmentTimes(parsedDate);

    const slots = availableTimes.map((isoDateTime) => {
      const startAt = new Date(isoDateTime);
      const endAt = new Date(startAt.getTime() + service.durationMinutes * 60 * 1000);
      const slotId = `${service.id}|${startAt.toISOString()}`;

      return {
        id: slotId,
        serviceId: service.id,
        date: formatDate(startAt),
        time: formatTime(startAt),
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        active: true,
      };
    });

    return res.json({
      serviceId: service.id,
      date,
      slots,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
