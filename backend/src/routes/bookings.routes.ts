import { Router } from "express";
import { z } from "zod";

import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import {
  sendBookingCancellationEmail,
  sendBookingConfirmationEmail,
  sendBookingUpdateEmail,
} from "../services/email.service.js";
import { isSlotAvailable } from "../utils/appointment-slots.js";
import { HttpError } from "../utils/http-error.js";

const router = Router();

const confirmBookingSchema = z.object({
  serviceId: z.string().min(1),
  slotId: z.string().min(1),
});

const rescheduleSchema = z.object({
  slotId: z.string().min(1),
});

function parseSlotId(slotId: string) {
  const [serviceId, isoDateTime] = slotId.split("|");

  if (!serviceId || !isoDateTime) {
    throw new HttpError(400, "Invalid slot id.");
  }

  const dateTime = new Date(isoDateTime);
  if (Number.isNaN(dateTime.getTime())) {
    throw new HttpError(400, "Invalid slot date/time.");
  }

  return { serviceId, dateTime };
}

function toApiStatus(status: "Pending" | "Confirmed" | "Rescheduled" | "Cancelled") {
  switch (status) {
    case "Pending":
      return "PENDING";
    case "Confirmed":
      return "CONFIRMED";
    case "Rescheduled":
      return "RESCHEDULED";
    case "Cancelled":
      return "CANCELLED";
    default:
      return "PENDING";
  }
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatTime(value: Date) {
  return value.toISOString().slice(11, 16);
}

function toBookingDto(appointment: {
  id: string;
  dateTime: Date;
  status: "Pending" | "Confirmed" | "Rescheduled" | "Cancelled";
  service: string | null;
  serviceRef?: {
    name: string;
  } | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
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

router.use(requireAuth);

router.post("/confirm", async (req, res, next) => {
  try {
    const body = confirmBookingSchema.parse(req.body);
    const slot = parseSlotId(body.slotId);

    if (slot.serviceId !== body.serviceId) {
      throw new HttpError(400, "Slot does not match selected service.");
    }

    const service = await prisma.service.findFirst({
      where: {
        id: body.serviceId,
        active: true,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!service) {
      throw new HttpError(404, "Service not found.");
    }

    const slotAvailable = await isSlotAvailable(slot.dateTime);
    if (!slotAvailable) {
      throw new HttpError(409, "Sorry, this appointment has already been booked.");
    }

    const appointment = await prisma.appointment.create({
      data: {
        userId: req.user!.userId,
        dateTime: slot.dateTime,
        serviceId: service.id,
        service: service.name,
        status: "Confirmed",
      },
      include: {
        user: true,
      },
    });

    await sendBookingConfirmationEmail({
      to: appointment.user.email,
      firstName: appointment.user.firstName,
      bookingId: appointment.id,
      service: appointment.service,
      appointmentDateTime: appointment.dateTime,
      status: toApiStatus(appointment.status),
    });

    return res.status(201).json({
      success: true,
      bookingId: appointment.id,
      status: toApiStatus(appointment.status),
      appointmentDate: formatDate(appointment.dateTime),
      appointmentTime: formatTime(appointment.dateTime),
      message: "Appointment confirmed successfully",
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", async (req, res, next) => {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { userId: req.user!.userId },
      orderBy: { dateTime: "asc" },
      include: {
        serviceRef: {
          select: {
            name: true,
          },
        },
      },
    });

    return res.json({
      bookings: appointments.map(toBookingDto),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
      include: {
        serviceRef: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new HttpError(404, "Booking not found.");
    }

    return res.json({
      booking: toBookingDto(appointment),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/reschedule", async (req, res, next) => {
  try {
    const body = rescheduleSchema.parse(req.body);
    const slot = parseSlotId(body.slotId);

    const service = await prisma.service.findFirst({
      where: {
        id: slot.serviceId,
        active: true,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!service) {
      throw new HttpError(404, "Service not found.");
    }

    const existing = await prisma.appointment.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
      include: {
        user: true,
      },
    });

    if (!existing) {
      throw new HttpError(404, "Booking not found.");
    }

    if (existing.status === "Cancelled") {
      throw new HttpError(400, "Cancelled bookings cannot be rescheduled.");
    }

    const slotAvailable = await isSlotAvailable(slot.dateTime, existing.id);
    if (!slotAvailable) {
      throw new HttpError(409, "Sorry, this appointment has already been booked.");
    }

    const updated = await prisma.appointment.update({
      where: { id: existing.id },
      data: {
        dateTime: slot.dateTime,
        serviceId: service.id,
        service: service.name,
        status: "Rescheduled",
        rescheduledFrom: existing.dateTime,
      },
      include: {
        user: true,
      },
    });

    await sendBookingUpdateEmail({
      to: updated.user.email,
      firstName: updated.user.firstName,
      appointmentDateTime: updated.dateTime,
      status: toApiStatus(updated.status),
    });

    return res.json({
      success: true,
      bookingId: updated.id,
      status: toApiStatus(updated.status),
      appointmentDate: formatDate(updated.dateTime),
      appointmentTime: formatTime(updated.dateTime),
      message: "Appointment rescheduled successfully",
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/cancel", async (req, res, next) => {
  try {
    const existing = await prisma.appointment.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
      include: {
        user: true,
      },
    });

    if (!existing) {
      throw new HttpError(404, "Booking not found.");
    }

    const updated = await prisma.appointment.update({
      where: { id: existing.id },
      data: {
        status: "Cancelled",
        cancelledAt: new Date(),
      },
      include: {
        user: true,
      },
    });

    await sendBookingCancellationEmail({
      to: updated.user.email,
      firstName: updated.user.firstName,
      bookingId: updated.id,
      service: updated.service,
      appointmentDateTime: updated.dateTime,
      status: toApiStatus(updated.status),
    });

    return res.json({
      success: true,
      bookingId: updated.id,
      status: toApiStatus(updated.status),
      appointmentDate: formatDate(updated.dateTime),
      appointmentTime: formatTime(updated.dateTime),
      message: "Appointment cancelled successfully",
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
