export const BUSINESS_TIME_ZONE =
  import.meta.env.VITE_BUSINESS_TIME_ZONE?.trim() || "Europe/London";

export function resolveAppointmentDateTime(date: Date, slot: string): string {
  const normalizedSlot = slot.trim();

  if (/^\d{4}-\d{2}-\d{2}T/.test(normalizedSlot)) {
    return normalizedSlot;
  }

  const [timePart, meridiem] = normalizedSlot.split(" ");
  let [hours, minutes] = timePart.split(":").map(Number);

  if (meridiem === "PM" && hours < 12) {
    hours += 12;
  }
  if (meridiem === "AM" && hours === 12) {
    hours = 0;
  }

  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next.toISOString();
}

export function formatSlotLabel(slot: string): string {
  const value = new Date(slot);
  if (Number.isNaN(value.getTime())) {
    return slot;
  }

  return value.toLocaleTimeString("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
