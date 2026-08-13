CREATE TABLE "WeatherSafetyState" (
    "id" TEXT NOT NULL DEFAULT 'pawside',
    "location" TEXT NOT NULL,
    "temperatureC" DOUBLE PRECISION NOT NULL,
    "feelsLikeC" DOUBLE PRECISION,
    "humidity" INTEGER,
    "condition" TEXT,
    "bookingBlocked" BOOLEAN NOT NULL DEFAULT false,
    "alertStartedAt" TIMESTAMP(3),
    "weatherObservedAt" TIMESTAMP(3) NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeatherSafetyState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WeatherAlertNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertStartedAt" TIMESTAMP(3) NOT NULL,
    "temperatureC" DOUBLE PRECISION NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherAlertNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeatherAlertNotification_userId_alertStartedAt_key"
ON "WeatherAlertNotification"("userId", "alertStartedAt");

CREATE INDEX "WeatherAlertNotification_alertStartedAt_idx"
ON "WeatherAlertNotification"("alertStartedAt");

ALTER TABLE "WeatherAlertNotification"
ADD CONSTRAINT "WeatherAlertNotification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
