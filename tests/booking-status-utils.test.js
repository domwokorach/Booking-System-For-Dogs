import { describe, expect, test } from '@jest/globals';

const { getStatusStyles } = await import('../src/app/lib/booking-status.js');

describe('booking status utilities', () => {
  test('returns an amber style for pending bookings', () => {
    expect(getStatusStyles('Pending')).toEqual(
      expect.objectContaining({ label: 'Pending', badgeClass: expect.stringContaining('amber') }),
    );
  });

  test('returns a green style for confirmed bookings', () => {
    expect(getStatusStyles('Confirmed')).toEqual(
      expect.objectContaining({ label: 'Confirmed', badgeClass: expect.stringContaining('emerald') }),
    );
  });

  test.each(['CancellationPending', 'CANCELLATION_PENDING'])(
    'shows cancellation pending for %s',
    (status) => {
      expect(getStatusStyles(status)).toEqual(
        expect.objectContaining({
          label: 'Cancellation pending',
          badgeClass: expect.stringContaining('amber'),
        }),
      );
    },
  );
});
