-- Snapshot duration on each appointment so later catalog edits do not
-- retroactively change the time occupied by an existing booking.
ALTER TABLE "Appointment"
ADD COLUMN "durationMinutes" INTEGER NOT NULL DEFAULT 60;

UPDATE "Appointment" AS appointment
SET "durationMinutes" = CASE
  -- Grooming was 60 minutes when every pre-migration row was created. The
  -- preceding catalog migration changes only future grooming appointments.
  WHEN service."id" = 'grooming' OR service."name" = 'Grooming' THEN 60
  WHEN service."durationMinutes" > 0 THEN service."durationMinutes"
  ELSE 60
END
FROM "Service" AS service
WHERE appointment."serviceId" = service."id";

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_durationMinutes_positive"
CHECK ("durationMinutes" > 0);

ALTER TABLE "Service"
ADD CONSTRAINT "Service_durationMinutes_positive"
CHECK ("durationMinutes" > 0);
