ALTER TYPE "AppointmentStatus"
ADD VALUE 'CANCELLATION_PENDING' BEFORE 'CANCELLED';

CREATE TYPE "AppointmentCancellationRequestStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'APPROVED'
);

ALTER TABLE "Appointment"
ADD COLUMN "cancellationRequestedAt" TIMESTAMP(3);

CREATE TABLE "AppointmentCancellationRequest" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "status" "AppointmentCancellationRequestStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AppointmentCancellationRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppointmentCancellationRequest_appointmentId_key"
ON "AppointmentCancellationRequest"("appointmentId");

CREATE UNIQUE INDEX "AppointmentCancellationRequest_tokenHash_key"
ON "AppointmentCancellationRequest"("tokenHash");

CREATE INDEX "AppointmentCancellationRequest_status_expiresAt_idx"
ON "AppointmentCancellationRequest"("status", "expiresAt");

ALTER TABLE "AppointmentCancellationRequest"
ADD CONSTRAINT "AppointmentCancellationRequest_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
