-- Keep persisted scheduling duration aligned with the client service catalog.
UPDATE "Service"
SET "durationMinutes" = 120,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'grooming'
   OR "name" = 'Grooming';
