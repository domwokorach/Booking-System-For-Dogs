import { $Enums } from "@prisma/client";
export function getReviewEligibility(appointment, now = new Date()) {
    if (appointment.hasReview) {
        return { canReview: false, reason: "ALREADY_REVIEWED", availableAt: null };
    }
    if (appointment.status === $Enums.AppointmentStatus.Cancelled ||
        appointment.status === $Enums.AppointmentStatus.CancellationPending) {
        return { canReview: false, reason: "CANCELLED", availableAt: null };
    }
    if (appointment.status !== $Enums.AppointmentStatus.Completed) {
        return { canReview: false, reason: "NOT_FINISHED", availableAt: null };
    }
    const availableAt = new Date(appointment.dateTime.getTime() + appointment.durationMinutes * 60000);
    if (availableAt > now) {
        return { canReview: false, reason: "NOT_FINISHED", availableAt };
    }
    return { canReview: true, reason: "AVAILABLE", availableAt };
}
