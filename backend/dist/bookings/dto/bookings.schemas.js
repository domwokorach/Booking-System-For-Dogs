import { z } from "zod";
export const createBookingSchema = z.object({
    serviceId: z.string().min(1),
    slotId: z.string().min(1),
});
export const rescheduleBookingSchema = z.object({
    slotId: z.string().min(1),
});
