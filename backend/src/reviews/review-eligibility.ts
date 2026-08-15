import { $Enums } from "@prisma/client";

export type ReviewEligibility = {
  canReview: boolean;
  reason: "AVAILABLE" | "ALREADY_REVIEWED" | "CANCELLED" | "NOT_FINISHED";
  availableAt: Date | null;
};

export function getReviewEligibility(
  appointment: {
    status: $Enums.AppointmentStatus;
    dateTime: Date;
    durationMinutes: number;
    hasReview: boolean;
  },
  now = new Date(),
): ReviewEligibility {
  if (appointment.hasReview) {
    return { canReview: false, reason: "ALREADY_REVIEWED", availableAt: null };
  }

  if (
    appointment.status === $Enums.AppointmentStatus.Cancelled ||
    appointment.status === $Enums.AppointmentStatus.CancellationPending
  ) {
    return { canReview: false, reason: "CANCELLED", availableAt: null };
  }

  if (appointment.status !== $Enums.AppointmentStatus.Completed) {
    return { canReview: false, reason: "NOT_FINISHED", availableAt: null };
  }

  const availableAt = new Date(
    appointment.dateTime.getTime() + appointment.durationMinutes * 60_000,
  );
  if (availableAt > now) {
    return { canReview: false, reason: "NOT_FINISHED", availableAt };
  }

  return { canReview: true, reason: "AVAILABLE", availableAt };
}
