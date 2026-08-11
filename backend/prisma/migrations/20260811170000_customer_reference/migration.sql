ALTER TABLE "User"
ADD COLUMN "customerReference" TEXT;

UPDATE "User"
SET "customerReference" =
  'PAW-' || UPPER(SUBSTRING(MD5("id") FROM 1 FOR 16));

ALTER TABLE "User"
ALTER COLUMN "customerReference" SET NOT NULL;

CREATE UNIQUE INDEX "User_customerReference_key"
ON "User"("customerReference");
