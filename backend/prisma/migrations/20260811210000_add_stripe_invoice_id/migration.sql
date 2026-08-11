ALTER TABLE "Payment"
ADD COLUMN "stripeInvoiceId" TEXT;

CREATE UNIQUE INDEX "Payment_stripeInvoiceId_key"
ON "Payment"("stripeInvoiceId");
