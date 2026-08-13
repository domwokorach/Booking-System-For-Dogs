import { AppointmentStatus } from "@prisma/client";
export function getReviewEligibility(appointment, now = new Date()) {
    if (appointment.hasReview) {
        return { canReview: false, reason: "ALREADY_REVIEWED", availableAt: null };
    }
    if (appointment.status === AppointmentStatus.Cancelled ||
        appointment.status === AppointmentStatus.CancellationPending) {
        return { canReview: false, reason: "CANCELLED", availableAt: null };
    }
    const availableAt = new Date(appointment.dateTime.getTime() + appointment.durationMinutes * 60_000);
    if (availableAt > now) {
        return { canReview: false, reason: "NOT_FINISHED", availableAt };
    }
    return { canReview: true, reason: "AVAILABLE", availableAt };
}
