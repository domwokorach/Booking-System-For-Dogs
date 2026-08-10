-- PostgreSQL remains the final authority for slot integrity, including writes
-- made outside the NestJS application. Cancelled appointments do not reserve
-- time, and adjacent half-open ranges are allowed.
ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_no_active_time_overlap"
EXCLUDE USING GIST (
  tsrange(
    "dateTime",
    "dateTime" + "durationMinutes" * INTERVAL '1 minute',
    '[)'
  ) WITH &&
)
WHERE ("status" IN ('PENDING', 'CONFIRMED', 'RESCHEDULED'));
