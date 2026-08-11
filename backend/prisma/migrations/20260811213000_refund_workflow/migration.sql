ALTER TYPE "PaymentStatus" ADD VALUE 'REFUND_PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUND_FAILED';

ALTER TABLE "Payment"
ADD COLUMN "stripeRefundId" TEXT,
ADD COLUMN "refundRequestedAt" TIMESTAMP(3),
ADD COLUMN "refundedAt" TIMESTAMP(3),
ADD COLUMN "refundFailedAt" TIMESTAMP(3),
ADD COLUMN "refundFailureReason" TEXT;

CREATE UNIQUE INDEX "Payment_stripeRefundId_key"
ON "Payment"("stripeRefundId");
