-- Store only authenticated customer reviews linked to completed appointments.
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "avatarUrl" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "petName" TEXT NOT NULL,
    "petBreed" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

-- One genuine review per appointment.
CREATE UNIQUE INDEX "Review_appointmentId_key" ON "Review"("appointmentId");

-- Index the non-unique foreign key and the public newest-first listing path.
CREATE INDEX "Review_customerId_idx" ON "Review"("customerId");
CREATE INDEX "Review_createdAt_idx" ON "Review"("createdAt" DESC);

ALTER TABLE "Review"
ADD CONSTRAINT "Review_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review"
ADD CONSTRAINT "Review_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
