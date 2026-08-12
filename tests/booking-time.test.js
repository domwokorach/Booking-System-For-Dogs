import { describe, expect, test } from '@jest/globals';

describe('booking time helpers', () => {
  test('preserves ISO slot values for submission and parses 12-hour labels', async () => {
    const { resolveAppointmentDateTime, formatSlotLabel } = await import('../src/app/lib/booking-time.js');

    const selectedDate = new Date(2026, 7, 9);

    expect(resolveAppointmentDateTime(selectedDate, '2026-08-09T09:00:00.000Z')).toBe('2026-08-09T09:00:00.000Z');
    expect(resolveAppointmentDateTime(selectedDate, '9:00 AM')).toBe('2026-08-09T08:00:00.000Z');
    expect(formatSlotLabel('2026-08-09T08:00:00.000Z')).toBe('9:00 AM');
  });
});
