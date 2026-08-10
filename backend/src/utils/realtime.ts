import type { Request } from "express";

export type AppointmentEvent =
  | "appointments:created"
  | "appointments:updated"
  | "appointments:rescheduled"
  | "appointments:confirmed"
  | "appointments:cancelled"
  | "appointments:deleted";

export function appointmentRoom(userId: string) {
  return `user:${userId}`;
}

export function emitAppointmentEvent(
  req: Request,
  userId: string,
  event: AppointmentEvent,
  payload: Record<string, unknown>,
) {
  req.app.get("io").to(appointmentRoom(userId)).emit(event, payload);
}
