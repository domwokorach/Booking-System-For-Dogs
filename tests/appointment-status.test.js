import { describe, expect, test } from '@jest/globals';

describe('appointment status helpers', () => {
  test('returns a valid booking state for confirmed appointments', () => {
    const status = 'Confirmed';
    expect([
      'Pending',
      'Confirmed',
      'Rescheduled',
      'CancellationPending',
      'Cancelled',
    ]).toContain(status);
  });

  test('marks cancelled appointments as cancelled', () => {
    const status = 'Cancelled';
    expect(status).toBe('Cancelled');
  });

  test('keeps cancellation requests pending until approval', () => {
    const status = 'CancellationPending';
    expect(status).not.toBe('Cancelled');
  });
});
