ALTER TABLE "Appointment"
DROP CONSTRAINT "Appointment_no_active_time_overlap";

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_no_active_time_overlap"
EXCLUDE USING GIST (
  tsrange(
    "dateTime",
    "dateTime" + "durationMinutes" * INTERVAL '1 minute',
    '[)'
  ) WITH &&
)
WHERE (
  "status" IN (
    'PENDING',
    'CONFIRMED',
    'RESCHEDULED',
    'CANCELLATION_PENDING'
  )
);
