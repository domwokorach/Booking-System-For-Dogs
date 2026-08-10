-- Rows created after the Grooming catalog changed to 120 minutes must keep
-- that new duration; the preceding backfill preserves only older rows at 60.
UPDATE "Appointment" AS appointment
SET "durationMinutes" = service."durationMinutes"
FROM "Service" AS service
WHERE appointment."serviceId" = service."id"
  AND (service."id" = 'grooming' OR service."name" = 'Grooming')
  AND appointment."createdAt" >= service."updatedAt";
