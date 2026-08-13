ALTER TABLE "WeatherSafetyState"
ADD COLUMN "safetyRestoredAt" TIMESTAMP(3),
ADD COLUMN "restoredAlertStartedAt" TIMESTAMP(3);

ALTER TABLE "WeatherAlertNotification"
ADD COLUMN "lastAttemptedAt" TIMESTAMP(3),
ADD COLUMN "safetyRestoredLastAttemptedAt" TIMESTAMP(3),
ADD COLUMN "safetyRestoredDeliveredAt" TIMESTAMP(3);
