CREATE TYPE "PaymentStatus" AS ENUM (
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED'
);

ALTER TABLE "Service"
ADD COLUMN "pricePence" INTEGER;

UPDATE "Service"
SET "pricePence" = CASE
  WHEN "id" = 'grooming' OR "name" = 'Grooming' THEN 5500
  WHEN "id" = 'training' OR "name" = 'Training' THEN 7500
  WHEN "id" = 'daycare' OR "name" = 'Daycare' THEN 4500
  WHEN "id" = 'boarding' OR "name" = 'Boarding' THEN 6500
  ELSE 5000
END;

ALTER TABLE "Service"
ALTER COLUMN "pricePence" SET NOT NULL;

ALTER TABLE "Service"
ADD CONSTRAINT "Service_pricePence_positive"
CHECK ("pricePence" > 0);

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "stripeCheckoutSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "amountPence" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'gbp',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "checkoutExpiresAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_amountPence_positive" CHECK ("amountPence" > 0),
  CONSTRAINT "Payment_currency_lowercase" CHECK ("currency" = LOWER("currency"))
);

CREATE UNIQUE INDEX "Payment_stripeCheckoutSessionId_key"
ON "Payment"("stripeCheckoutSessionId");

CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key"
ON "Payment"("stripePaymentIntentId");

CREATE INDEX "Payment_appointmentId_createdAt_idx"
ON "Payment"("appointmentId", "createdAt" DESC);

CREATE INDEX "Payment_userId_idx"
ON "Payment"("userId");

CREATE INDEX "Payment_status_idx"
ON "Payment"("status");

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
