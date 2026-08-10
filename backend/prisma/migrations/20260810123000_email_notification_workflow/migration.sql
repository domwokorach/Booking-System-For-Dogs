-- Store appointment states in the uppercase form used by the public API.
ALTER TYPE "AppointmentStatus" RENAME VALUE 'Pending' TO 'PENDING';
ALTER TYPE "AppointmentStatus" RENAME VALUE 'Confirmed' TO 'CONFIRMED';
ALTER TYPE "AppointmentStatus" RENAME VALUE 'Rescheduled' TO 'RESCHEDULED';
ALTER TYPE "AppointmentStatus" RENAME VALUE 'Cancelled' TO 'CANCELLED';

-- Persist account-deletion request state instead of storing only a token.
CREATE TYPE "AccountDeletionRequestStatus" AS ENUM ('PENDING', 'CANCELLED', 'COMPLETED');

ALTER TABLE "AccountDeletionToken" RENAME TO "AccountDeletionRequest";
ALTER TABLE "AccountDeletionRequest"
  RENAME CONSTRAINT "AccountDeletionToken_pkey" TO "AccountDeletionRequest_pkey";
ALTER TABLE "AccountDeletionRequest"
  RENAME CONSTRAINT "AccountDeletionToken_userId_fkey" TO "AccountDeletionRequest_userId_fkey";

ALTER INDEX "AccountDeletionToken_tokenHash_key" RENAME TO "AccountDeletionRequest_tokenHash_key";
ALTER INDEX "AccountDeletionToken_expiresAt_idx" RENAME TO "AccountDeletionRequest_expiresAt_idx";
DROP INDEX "AccountDeletionToken_userId_idx";

ALTER TABLE "AccountDeletionRequest"
  ADD COLUMN "status" "AccountDeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- One current request per account also provides the FK lookup index needed
-- for fast user deletion cascades.
CREATE UNIQUE INDEX "AccountDeletionRequest_userId_key"
  ON "AccountDeletionRequest"("userId");
