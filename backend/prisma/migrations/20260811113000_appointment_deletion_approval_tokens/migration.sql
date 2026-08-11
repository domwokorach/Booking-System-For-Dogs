-- Replace legacy shared-secret appointment deletion approvals with
-- per-request, expiring, single-use tokens.
UPDATE "Appointment"
SET "deleteRequestedAt" = NULL
WHERE "deleteRequestedAt" IS NOT NULL;

CREATE TABLE "AppointmentDeletionRequest" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentDeletionRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppointmentDeletionRequest_appointmentId_key"
ON "AppointmentDeletionRequest"("appointmentId");

CREATE UNIQUE INDEX "AppointmentDeletionRequest_tokenHash_key"
ON "AppointmentDeletionRequest"("tokenHash");

CREATE INDEX "AppointmentDeletionRequest_expiresAt_idx"
ON "AppointmentDeletionRequest"("expiresAt");

ALTER TABLE "AppointmentDeletionRequest"
ADD CONSTRAINT "AppointmentDeletionRequest_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
