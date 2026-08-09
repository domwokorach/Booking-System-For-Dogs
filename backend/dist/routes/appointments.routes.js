import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middlewares/auth.js";
import { resolveBookingRecipient, sendBookingCancellationEmail, sendBookingConfirmationEmail, sendDeletionRequestEmail, sendBookingUpdateEmail, } from "../services/email.service.js";
import { getAvailableAppointmentTimes, isSlotAvailable, } from "../utils/appointment-slots.js";
import { HttpError } from "../utils/http-error.js";
const router = Router();
const createAppointmentSchema = z.object({
    dateTime: z.coerce.date(),
    service: z.string().min(1).optional(),
    notes: z.string().max(2000).optional(),
});
const rescheduleSchema = z.object({
    dateTime: z.coerce.date(),
    notes: z.string().max(2000).optional(),
});
const updateAppointmentSchema = z.object({
    service: z.string().min(1).optional(),
    notes: z.string().max(2000).optional(),
});
const dateQuerySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
async function resolveActiveService(serviceId) {
    const service = await prisma.service.findFirst({
        where: {
            id: serviceId,
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
    return service;
}
router.get("/available", async (req, res, next) => {
    try {
        const { date } = dateQuerySchema.parse(req.query);
        const parsedDate = new Date(`${date}T00:00:00.000Z`);
        const slots = await getAvailableAppointmentTimes(parsedDate);
        return res.json({
            date,
            availableTimes: slots,
        });
    }
    catch (error) {
        return next(error);
    }
});
router.use(requireAuth);
router.get("/mine", async (req, res, next) => {
    try {
        const appointments = await prisma.appointment.findMany({
            where: { userId: req.user.userId },
            orderBy: { dateTime: "asc" },
        });
        return res.json(appointments);
    }
    catch (error) {
        return next(error);
    }
});
router.post("/", async (req, res, next) => {
    try {
        const body = createAppointmentSchema.parse(req.body);
        const service = body.service ? await resolveActiveService(body.service) : null;
        const available = await isSlotAvailable(body.dateTime);
        if (!available) {
            throw new HttpError(409, "This appointment slot is already booked.");
        }
        const appointment = await prisma.appointment.create({
            data: {
                userId: req.user.userId,
                dateTime: body.dateTime,
                serviceId: service?.id,
                service: service?.name,
                notes: body.notes,
                status: "Confirmed",
                confirmedAt: new Date(),
            },
            include: {
                user: true,
                serviceRef: true,
            },
        });
        // Automatic booking notification when appointment is created.
        await sendBookingConfirmationEmail({
            to: appointment.user.email,
            firstName: appointment.user.firstName,
            bookingId: appointment.id,
            service: appointment.serviceRef?.name ?? appointment.service,
            appointmentDateTime: appointment.dateTime,
            status: appointment.status,
        });
        req.app.get("io").emit("appointments:created", {
            appointmentId: appointment.id,
            dateTime: appointment.dateTime,
            status: appointment.status,
        });
        return res.status(201).json({
            ...appointment,
            notificationRecipient: resolveBookingRecipient(appointment.user.email),
        });
    }
    catch (error) {
        return next(error);
    }
});
router.patch("/:id", async (req, res, next) => {
    try {
        const body = updateAppointmentSchema.parse(req.body);
        const appointmentId = req.params.id;
        const service = body.service ? await resolveActiveService(body.service) : null;
        const existing = await prisma.appointment.findFirst({
            where: {
                id: appointmentId,
                userId: req.user.userId,
            },
            include: {
                user: true,
            },
        });
        if (!existing) {
            throw new HttpError(404, "Appointment not found.");
        }
        const updated = await prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                serviceId: body.service ? service?.id : undefined,
                service: body.service ? service?.name : undefined,
                notes: body.notes,
            },
            include: {
                user: true,
                serviceRef: true,
            },
        });
        await sendBookingUpdateEmail({
            to: updated.user.email,
            firstName: updated.user.firstName,
            appointmentDateTime: updated.dateTime,
            status: updated.status,
        });
        req.app.get("io").emit("appointments:updated", {
            appointmentId: updated.id,
            dateTime: updated.dateTime,
            status: updated.status,
        });
        return res.json({
            ...updated,
            notificationRecipient: resolveBookingRecipient(updated.user.email),
        });
    }
    catch (error) {
        return next(error);
    }
});
router.patch("/:id/reschedule", async (req, res, next) => {
    try {
        const body = rescheduleSchema.parse(req.body);
        const appointmentId = req.params.id;
        const existing = await prisma.appointment.findFirst({
            where: {
                id: appointmentId,
                userId: req.user.userId,
            },
            include: {
                user: true,
            },
        });
        if (!existing) {
            throw new HttpError(404, "Appointment not found.");
        }
        const available = await isSlotAvailable(body.dateTime, appointmentId);
        if (!available) {
            throw new HttpError(409, "The requested time is not available.");
        }
        const updated = await prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                dateTime: body.dateTime,
                rescheduledFrom: existing.dateTime,
                notes: body.notes ?? existing.notes,
                status: "Rescheduled",
            },
            include: {
                user: true,
            },
        });
        await sendBookingUpdateEmail({
            to: updated.user.email,
            firstName: updated.user.firstName,
            appointmentDateTime: updated.dateTime,
            status: updated.status,
        });
        req.app.get("io").emit("appointments:rescheduled", {
            appointmentId: updated.id,
            dateTime: updated.dateTime,
            status: updated.status,
        });
        return res.json({
            ...updated,
            notificationRecipient: resolveBookingRecipient(updated.user.email),
        });
    }
    catch (error) {
        return next(error);
    }
});
router.patch("/:id/confirm", async (req, res, next) => {
    try {
        const appointmentId = req.params.id;
        const existing = await prisma.appointment.findFirst({
            where: {
                id: appointmentId,
                userId: req.user.userId,
            },
            include: {
                user: true,
            },
        });
        if (!existing) {
            throw new HttpError(404, "Appointment not found.");
        }
        if (existing.status === "Cancelled") {
            throw new HttpError(400, "Cancelled appointments cannot be confirmed.");
        }
        const updated = await prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                status: "Confirmed",
                confirmedAt: new Date(),
            },
            include: {
                user: true,
            },
        });
        await sendBookingConfirmationEmail({
            to: updated.user.email,
            firstName: updated.user.firstName,
            bookingId: updated.id,
            service: updated.service,
            appointmentDateTime: updated.dateTime,
            status: updated.status,
        });
        req.app.get("io").emit("appointments:confirmed", {
            appointmentId: updated.id,
            dateTime: updated.dateTime,
            status: updated.status,
        });
        return res.json(updated);
    }
    catch (error) {
        return next(error);
    }
});
router.patch("/:id/cancel", async (req, res, next) => {
    try {
        const appointmentId = req.params.id;
        const existing = await prisma.appointment.findFirst({
            where: {
                id: appointmentId,
                userId: req.user.userId,
            },
            include: {
                user: true,
            },
        });
        if (!existing) {
            throw new HttpError(404, "Appointment not found.");
        }
        const updated = await prisma.appointment.update({
            where: { id: appointmentId },
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
            status: updated.status,
        });
        req.app.get("io").emit("appointments:cancelled", {
            appointmentId: updated.id,
            dateTime: updated.dateTime,
            status: updated.status,
        });
        return res.json(updated);
    }
    catch (error) {
        return next(error);
    }
});
router.delete("/:id", async (req, res, next) => {
    try {
        const approvalToken = req.header("x-delete-approval-token")?.trim();
        if (!approvalToken || !env.DELETE_APPROVAL_TOKEN.trim() || approvalToken !== env.DELETE_APPROVAL_TOKEN.trim()) {
            throw new HttpError(403, "Deletion approval required.");
        }
        const appointment = await prisma.appointment.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.userId,
            },
            include: {
                user: true,
            },
        });
        if (!appointment) {
            throw new HttpError(404, "Appointment not found.");
        }
        if (!appointment.deleteRequestedAt) {
            throw new HttpError(400, "Deletion request not found.");
        }
        await sendBookingCancellationEmail({
            to: appointment.user.email,
            firstName: appointment.user.firstName,
            bookingId: appointment.id,
            service: appointment.service,
            appointmentDateTime: appointment.dateTime,
            status: appointment.status,
        });
        await prisma.appointment.delete({
            where: { id: appointment.id },
        });
        req.app.get("io").emit("appointments:deleted", {
            appointmentId: appointment.id,
        });
        return res.json({ message: "Appointment deleted successfully" });
    }
    catch (error) {
        return next(error);
    }
});
router.post("/:id/delete-request", async (req, res, next) => {
    try {
        const appointment = await prisma.appointment.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.userId,
            },
            include: {
                user: true,
            },
        });
        if (!appointment) {
            throw new HttpError(404, "Appointment not found.");
        }
        if (appointment.deleteRequestedAt) {
            return res.json({ message: "Deletion request already sent." });
        }
        const updated = await prisma.appointment.update({
            where: { id: appointment.id },
            data: {
                deleteRequestedAt: new Date(),
            },
            include: {
                user: true,
            },
        });
        await sendDeletionRequestEmail({
            to: updated.user.email,
            firstName: updated.user.firstName,
            bookingId: updated.id,
            service: updated.service,
            appointmentDateTime: updated.dateTime,
            status: updated.status,
        });
        req.app.get("io").emit("appointments:updated", {
            appointmentId: updated.id,
            dateTime: updated.dateTime,
            status: updated.status,
        });
        return res.json({ message: "Deletion request sent for approval." });
    }
    catch (error) {
        return next(error);
    }
});
router.post("/:id/email/confirmation", async (req, res, next) => {
    try {
        const appointment = await prisma.appointment.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.userId,
            },
            include: {
                user: true,
            },
        });
        if (!appointment) {
            throw new HttpError(404, "Appointment not found.");
        }
        await sendBookingConfirmationEmail({
            to: appointment.user.email,
            firstName: appointment.user.firstName,
            bookingId: appointment.id,
            service: appointment.service,
            appointmentDateTime: appointment.dateTime,
            status: appointment.status,
        });
        return res.json({ message: "Booking confirmation email sent." });
    }
    catch (error) {
        return next(error);
    }
});
router.post("/:id/email/update", async (req, res, next) => {
    try {
        const appointment = await prisma.appointment.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.userId,
            },
            include: {
                user: true,
            },
        });
        if (!appointment) {
            throw new HttpError(404, "Appointment not found.");
        }
        await sendBookingUpdateEmail({
            to: appointment.user.email,
            firstName: appointment.user.firstName,
            appointmentDateTime: appointment.dateTime,
            status: appointment.status,
        });
        return res.json({ message: "Booking update email sent." });
    }
    catch (error) {
        return next(error);
    }
});
router.post("/:id/email/cancellation", async (req, res, next) => {
    try {
        const appointment = await prisma.appointment.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.userId,
            },
            include: {
                user: true,
            },
        });
        if (!appointment) {
            throw new HttpError(404, "Appointment not found.");
        }
        await sendBookingCancellationEmail({
            to: appointment.user.email,
            firstName: appointment.user.firstName,
            bookingId: appointment.id,
            service: appointment.service,
            appointmentDateTime: appointment.dateTime,
            status: appointment.status,
        });
        return res.json({ message: "Booking cancellation email sent." });
    }
    catch (error) {
        return next(error);
    }
});
export default router;
