const STATUS_STYLES: Record<string, { label: string; badgeClass: string }> = {
  Pending: {
    label: "Pending",
    badgeClass: "bg-amber-100 text-amber-700 border border-amber-300",
  },
  Confirmed: {
    label: "Confirmed",
    badgeClass: "bg-emerald-100 text-emerald-700 border border-emerald-300",
  },
  Rescheduled: {
    label: "Rescheduled",
    badgeClass: "bg-sky-100 text-sky-700 border border-sky-300",
  },
  CancellationPending: {
    label: "Cancellation pending",
    badgeClass: "bg-amber-100 text-amber-800 border border-amber-300",
  },
  CANCELLATION_PENDING: {
    label: "Cancellation pending",
    badgeClass: "bg-amber-100 text-amber-800 border border-amber-300",
  },
  Cancelled: {
    label: "Cancelled",
    badgeClass: "bg-rose-100 text-rose-700 border border-rose-300",
  },
};

export function getStatusStyles(status: string) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.Pending;
}
