-- CreateTable
CREATE TABLE "AccountDeletionToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountDeletionToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountDeletionToken_tokenHash_key" ON "AccountDeletionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountDeletionToken_userId_idx" ON "AccountDeletionToken"("userId");

-- CreateIndex
CREATE INDEX "AccountDeletionToken_expiresAt_idx" ON "AccountDeletionToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "AccountDeletionToken"
ADD CONSTRAINT "AccountDeletionToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
