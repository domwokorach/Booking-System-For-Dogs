import {
  Gauge,
  Home,
  RefreshCw,
  SearchX,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { LiveNetworkStatus } from "../lib/network-status";

export type NetworkStatusPageState = Exclude<LiveNetworkStatus, null> | "not-found";

interface NetworkStatusPageProps {
  state: NetworkStatusPageState;
  requestedPath?: string;
  onNavigateHome: () => void;
  onRetry: () => void;
}

const statusContent: Record<
  NetworkStatusPageState,
  {
    eyebrow: string;
    title: string;
    description: string;
    icon: typeof Wifi;
    iconClass: string;
    panelClass: string;
  }
> = {
  "not-found": {
    eyebrow: "404",
    title: "Page Not Found",
    description:
      "The page you requested does not exist or may have moved. Return to Pawside and continue from the homepage.",
    icon: SearchX,
    iconClass: "text-slate-700",
    panelClass: "border-slate-200 bg-slate-50",
  },
  "no-internet": {
    eyebrow: "Network status",
    title: "No Internet Connection",
    description:
      "Pawside cannot detect a network connection. Check your router, mobile data, or device settings and try again.",
    icon: WifiOff,
    iconClass: "text-red-700",
    panelClass: "border-red-200 bg-red-50",
  },
  "wifi-disconnected": {
    eyebrow: "Network status",
    title: "Wi-Fi Disconnected",
    description:
      "Your browser reports that the network is offline and Wi-Fi may have disconnected. Reconnect to Wi-Fi and try again.",
    icon: WifiOff,
    iconClass: "text-amber-700",
    panelClass: "border-amber-200 bg-amber-50",
  },
  "slow-network": {
    eyebrow: "Network status",
    title: "Slow Network Connection",
    description:
      "Your connection appears slower than usual. Booking information may take longer to load or update.",
    icon: Gauge,
    iconClass: "text-amber-700",
    panelClass: "border-amber-200 bg-amber-50",
  },
  "connection-restored": {
    eyebrow: "Network status",
    title: "Connection Restored",
    description:
      "Your device is back online. Pawside will return you to your previous page automatically.",
    icon: Wifi,
    iconClass: "text-emerald-700",
    panelClass: "border-emerald-200 bg-emerald-50",
  },
};

export function NetworkStatusPage({
  state,
  requestedPath,
  onNavigateHome,
  onRetry,
}: NetworkStatusPageProps) {
  const content = statusContent[state];
  const StatusIcon = content.icon;
  const isNotFound = state === "not-found";
  const isRestored = state === "connection-restored";

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-6 py-16">
      <section
        role="status"
        aria-live="polite"
        className={`w-full max-w-2xl rounded-3xl border p-8 text-center shadow-sm sm:p-12 ${content.panelClass}`}
      >
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ${content.iconClass}`}
        >
          <StatusIcon size={30} aria-hidden="true" />
        </div>
        <p className={`mt-7 text-xs font-semibold uppercase tracking-[0.2em] ${content.iconClass}`}>
          {content.eyebrow}
        </p>
        <h1 className="mt-2 font-serif text-4xl font-bold text-foreground sm:text-5xl">
          {content.title}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
          {content.description}
        </p>

        {isNotFound && requestedPath ? (
          <p className="mx-auto mt-5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border border-slate-200 bg-white/70 px-3 py-2 font-mono text-xs text-slate-600">
            {requestedPath}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {!isRestored ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              <RefreshCw size={16} aria-hidden="true" />
              {isNotFound ? "Check again" : "Retry connection"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-5 py-3 text-sm font-semibold text-foreground"
          >
            <Home size={16} aria-hidden="true" />
            Return home
          </button>
        </div>
      </section>
    </main>
  );
}
