-- The unique appointmentId index already supports the foreign key and lookup.
DROP INDEX IF EXISTS "AppointmentDeletionRequest_appointmentId_idx";
