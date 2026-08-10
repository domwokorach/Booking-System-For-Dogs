import { z } from "zod";

import { dateKeySchema } from "../../common/validation/date-key.schema.js";

export const createAppointmentSchema = z.object({
  dateTime: z.coerce.date(),
  service: z.string().min(1).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateAppointmentSchema = z.object({
  service: z.string().min(1).optional(),
  notes: z.string().max(2000).optional(),
});

export const rescheduleAppointmentSchema = z.object({
  dateTime: z.coerce.date(),
  notes: z.string().max(2000).optional(),
});

export const availableAppointmentsQuerySchema = z.object({
  date: dateKeySchema,
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<
  typeof rescheduleAppointmentSchema
>;
