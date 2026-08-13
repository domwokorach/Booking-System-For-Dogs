import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock3,
  MapPin,
  RefreshCw,
  ShieldCheck,
  ThermometerSun,
  X,
} from "lucide-react";

export interface WeatherSafetyStatus {
  location: string;
  timeZone: string;
  currentLocalTime: string;
  temperatureC: number;
  feelsLikeC: number | null;
  humidity: number | null;
  condition: string | null;
  safetyLevel: "SAFE" | "CAUTION" | "HEAT_WARNING";
  heatWarning: boolean;
  bookingBlocked: boolean;
  alertStartedAt: string | null;
  observedAt: string;
  checkedAt: string;
  stale: boolean;
}

interface WeatherSafetyPanelProps {
  weather: WeatherSafetyStatus | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function formatTemperature(value: number): string {
  return `${Math.round(value * 10) / 10}°C`;
}

export function WeatherSafetyPanel({
  weather,
  loading,
  error,
  onRefresh,
}: WeatherSafetyPanelProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const localTime = useMemo(() => {
    if (!weather) {
      return "Loading local time…";
    }
    try {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: weather.timeZone,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(now);
    } catch {
      return weather.currentLocalTime;
    }
  }, [now, weather]);

  const safetyMessage = !weather
    ? "Loading the latest conditions for Pawside."
    : weather.heatWarning
      ? "Avoid taking your dog outside unless necessary. Appointment booking is temporarily unavailable."
      : weather.temperatureC < 25
        ? "Conditions are generally safer for walking, depending on your dog, humidity, ground temperature, and other weather conditions."
        : weather.bookingBlocked
          ? "The temperature is falling, but appointments will remain unavailable until it drops below 25°C."
          : "Conditions are warm. Consider your dog’s age, breed, health, humidity, and the ground temperature before walking.";

  const panelStyle = weather?.heatWarning
    ? "border-red-200 bg-red-50"
    : weather?.safetyLevel === "CAUTION"
      ? "border-amber-200 bg-amber-50"
      : "border-emerald-200 bg-emerald-50";
  const accentStyle = weather?.heatWarning
    ? "text-red-700"
    : weather?.safetyLevel === "CAUTION"
      ? "text-amber-700"
      : "text-emerald-700";

  return (
    <section id="weather-safety" className="bg-background px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Live local conditions
            </p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-foreground sm:text-4xl">
              Weather and Dog Safety
            </h2>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground disabled:opacity-60"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh weather
          </button>
        </div>

        <div className={`rounded-3xl border p-7 shadow-sm sm:p-9 ${panelStyle}`}>
          {error && !weather ? (
            <div role="alert" className="text-sm text-red-700">
              {error}
            </div>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-3">
                <WeatherDetail
                  icon={MapPin}
                  label="Location"
                  value={weather?.location ?? "Essex, UK"}
                />
                <WeatherDetail icon={Clock3} label="Current local time" value={localTime} />
                <WeatherDetail
                  icon={ThermometerSun}
                  label="Current temperature"
                  value={weather ? formatTemperature(weather.temperatureC) : "Loading…"}
                />
              </div>

              <div className="mt-7 border-t border-current/10 pt-6">
                <div className={`flex items-start gap-3 ${accentStyle}`}>
                  {weather?.heatWarning ? (
                    <AlertTriangle size={22} className="mt-0.5 shrink-0" />
                  ) : (
                    <ShieldCheck size={22} className="mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold">
                      {weather?.heatWarning
                        ? "High-temperature warning"
                        : weather?.bookingBlocked
                          ? "Appointments remain unavailable"
                          : "Dog safety guidance"}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {safetyMessage}
                    </p>
                    {weather ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {weather.condition ? `${weather.condition} · ` : ""}
                        {weather.humidity !== null ? `${weather.humidity}% humidity · ` : ""}
                        {weather.stale ? "Last known conditions" : "Updated conditions"}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

interface WeatherDetailProps {
  icon: typeof MapPin;
  label: string;
  value: string;
}

function WeatherDetail({ icon: Icon, label, value }: WeatherDetailProps) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon size={15} />
        {label}
      </div>
      <p className="mt-3 font-serif text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

export function HeatSafetyAlert({ weather }: { weather: WeatherSafetyStatus | null }) {
  const alertKey = weather?.alertStartedAt ?? weather?.checkedAt ?? null;
  const storageKey = alertKey ? `pawside_heat_alert_dismissed:${alertKey}` : null;
  const [dismissedKey, setDismissedKey] = useState<string | null>(() => {
    if (!storageKey) {
      return null;
    }
    return window.sessionStorage.getItem(storageKey) === "true" ? alertKey : null;
  });

  useEffect(() => {
    if (!storageKey || !alertKey) {
      setDismissedKey(null);
      return;
    }
    setDismissedKey(
      window.sessionStorage.getItem(storageKey) === "true" ? alertKey : null,
    );
  }, [alertKey, storageKey]);

  if (!weather?.heatWarning || !alertKey || dismissedKey === alertKey) {
    return null;
  }

  function dismiss() {
    if (storageKey && alertKey) {
      window.sessionStorage.setItem(storageKey, "true");
      setDismissedKey(alertKey);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="heat-warning-title"
        aria-describedby="heat-warning-description"
        className="relative w-full max-w-lg rounded-3xl border border-red-200 bg-white p-7 shadow-2xl sm:p-9"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss high-temperature warning"
          className="absolute right-5 top-5 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X size={19} />
        </button>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
          <AlertTriangle size={24} />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-red-700">
          Dog safety alert
        </p>
        <h2 id="heat-warning-title" className="mt-2 font-serif text-3xl font-bold text-foreground">
          High-temperature warning
        </h2>
        <p id="heat-warning-description" className="mt-4 text-sm leading-7 text-muted-foreground">
          It is currently {formatTemperature(weather.temperatureC)} in {weather.location}.
          Avoid taking your dog outside unless necessary. Appointment booking is paused
          and will reopen after the temperature falls below 25°C.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-7 w-full rounded-xl bg-red-700 px-5 py-3 text-sm font-semibold text-white"
        >
          I understand
        </button>
      </section>
    </div>
  );
}
