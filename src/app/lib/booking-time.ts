export const BUSINESS_TIME_ZONE =
  import.meta.env?.VITE_BUSINESS_TIME_ZONE?.trim() || "Europe/London";

function getTimeZoneOffset(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );

  return Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  ) - date.getTime();
}

function businessDateTimeToIso(
  date: Date,
  hours: number,
  minutes: number,
): string {
  const wallClockTime = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
  );
  const initialOffset = getTimeZoneOffset(
    new Date(wallClockTime),
    BUSINESS_TIME_ZONE,
  );
  const initialCandidate = new Date(wallClockTime - initialOffset);
  const finalOffset = getTimeZoneOffset(initialCandidate, BUSINESS_TIME_ZONE);

  return new Date(wallClockTime - finalOffset).toISOString();
}

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

  return businessDateTimeToIso(date, hours, minutes);
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
