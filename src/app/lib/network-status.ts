import { useCallback, useEffect, useRef, useState } from "react";

export type LiveNetworkStatus =
  | "no-internet"
  | "wifi-disconnected"
  | "slow-network"
  | "connection-restored"
  | null;

export interface NetworkInformationLike extends EventTarget {
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
  type?: string;
}

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
};

function getNetworkInformation(): NetworkInformationLike | null {
  const networkNavigator = window.navigator as NavigatorWithConnection;
  return (
    networkNavigator.connection ??
    networkNavigator.mozConnection ??
    networkNavigator.webkitConnection ??
    null
  );
}

export function isSlowConnection(connection: NetworkInformationLike | null): boolean {
  if (!connection) {
    return false;
  }

  const effectiveType = connection.effectiveType?.toLowerCase();
  const slowEffectiveType = effectiveType === "slow-2g" || effectiveType === "2g";
  const slowDownlink =
    typeof connection.downlink === "number" &&
    connection.downlink > 0 &&
    connection.downlink < 1;
  const slowRoundTrip =
    typeof connection.rtt === "number" && connection.rtt >= 1000;

  return slowEffectiveType || slowDownlink || slowRoundTrip;
}

function getOfflineStatus(
  previousConnectionType: string | null,
): Exclude<LiveNetworkStatus, "slow-network" | "connection-restored" | null> {
  if (previousConnectionType === "wifi") {
    return "wifi-disconnected";
  }

  return "no-internet";
}

export function useLiveNetworkStatus() {
  const connection = getNetworkInformation();
  const previousConnectionType = useRef<string | null>(
    connection?.type?.toLowerCase() ?? null,
  );
  const restoredTimer = useRef<number | null>(null);
  const [status, setStatus] = useState<LiveNetworkStatus>(() => {
    if (!window.navigator.onLine) {
      return getOfflineStatus(previousConnectionType.current);
    }

    return isSlowConnection(connection) ? "slow-network" : null;
  });
  const previousIssue = useRef<LiveNetworkStatus>(status);

  const updateStatus = useCallback((nextStatus: LiveNetworkStatus) => {
    previousIssue.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const showRestoredThenClear = useCallback(() => {
    if (restoredTimer.current !== null) {
      window.clearTimeout(restoredTimer.current);
    }

    updateStatus("connection-restored");
    restoredTimer.current = window.setTimeout(() => {
      const latestConnection = getNetworkInformation();
      updateStatus(isSlowConnection(latestConnection) ? "slow-network" : null);
      restoredTimer.current = null;
    }, 4000);
  }, [updateStatus]);

  const recheck = useCallback(() => {
    const latestConnection = getNetworkInformation();
    if (!window.navigator.onLine) {
      updateStatus(
        getOfflineStatus(previousConnectionType.current),
      );
      return;
    }

    updateStatus(isSlowConnection(latestConnection) ? "slow-network" : null);
  }, [updateStatus]);

  useEffect(() => {
    const networkInformation = getNetworkInformation();

    function handleOffline() {
      if (restoredTimer.current !== null) {
        window.clearTimeout(restoredTimer.current);
        restoredTimer.current = null;
      }
      updateStatus(
        getOfflineStatus(previousConnectionType.current),
      );
    }

    function handleOnline() {
      showRestoredThenClear();
    }

    function handleConnectionChange() {
      const nextConnection = getNetworkInformation();
      const nextType = nextConnection?.type?.toLowerCase() ?? null;

      if (!window.navigator.onLine) {
        updateStatus(
          getOfflineStatus(previousConnectionType.current),
        );
      } else if (isSlowConnection(nextConnection)) {
        updateStatus("slow-network");
      } else if (
        previousIssue.current === "slow-network" ||
        previousIssue.current === "no-internet" ||
        previousIssue.current === "wifi-disconnected"
      ) {
        showRestoredThenClear();
      } else {
        updateStatus(null);
      }

      previousConnectionType.current = nextType;
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    networkInformation?.addEventListener("change", handleConnectionChange);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      networkInformation?.removeEventListener("change", handleConnectionChange);
      if (restoredTimer.current !== null) {
        window.clearTimeout(restoredTimer.current);
      }
    };
  }, [showRestoredThenClear, updateStatus]);

  return { status, recheck };
}
