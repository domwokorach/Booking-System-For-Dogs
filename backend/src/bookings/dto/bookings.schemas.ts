import { z } from "zod";

import { dateKeySchema } from "../../common/validation/date-key.schema.js";

export const createBookingSchema = z.object({
  serviceId: z.string().min(1),
  slotId: z.string().min(1),
});

export const rescheduleBookingSchema = z.object({
  slotId: z.string().min(1),
});

export const rescheduleBookingSlotsQuerySchema = z.object({
  serviceId: z.string().min(1),
  date: dateKeySchema,
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;
export type RescheduleBookingSlotsQuery = z.infer<
  typeof rescheduleBookingSlotsQuerySchema
>;
