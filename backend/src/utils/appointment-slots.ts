import { prisma } from "../config/prisma.js";

const ACTIVE_APPOINTMENT_STATUSES: Array<"Pending" | "Confirmed" | "Rescheduled"> = [
  "Pending",
  "Confirmed",
  "Rescheduled",
];

function buildSlotDate(baseDate: Date, hour: number): Date {
  const date = new Date(baseDate);
  date.setHours(hour, 0, 0, 0);
  return date;
}

export async function getAvailableAppointmentTimes(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const businessHours = Array.from({ length: 9 }, (_, i) => 9 + i);
  const allSlots = businessHours.map((hour) => buildSlotDate(start, hour));

  const appointments = await prisma.appointment.findMany({
    where: {
      dateTime: {
        gte: start,
        lt: end,
      },
      status: {
        in: ACTIVE_APPOINTMENT_STATUSES,
      },
    },
    select: {
      dateTime: true,
    },
  });

  const taken = new Set(
    appointments.map((appointment: { dateTime: Date }) => appointment.dateTime.getTime()),
  );

  return allSlots
    .filter((slot) => !taken.has(slot.getTime()))
    .map((slot) => slot.toISOString());
}

export async function isSlotAvailable(dateTime: Date, excludeAppointmentId?: string) {
  const existing = await prisma.appointment.findFirst({
    where: {
      id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
      dateTime,
      status: {
        in: ACTIVE_APPOINTMENT_STATUSES,
      },
    },
    select: {
      id: true,
    },
  });

  return !existing;
}
