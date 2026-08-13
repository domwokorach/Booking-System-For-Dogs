import { describe, expect, test } from '@jest/globals';

const { isSlowConnection } = await import('../src/app/lib/network-status.js');

describe('network status utilities', () => {
  test.each(['slow-2g', '2g'])('detects %s as a slow connection', (effectiveType) => {
    expect(isSlowConnection({ effectiveType })).toBe(true);
  });

  test('detects low bandwidth and high latency', () => {
    expect(isSlowConnection({ downlink: 0.75 })).toBe(true);
    expect(isSlowConnection({ rtt: 1000 })).toBe(true);
  });

  test('does not mark a healthy or unavailable estimate as slow', () => {
    expect(isSlowConnection({ effectiveType: '4g', downlink: 10, rtt: 50 })).toBe(false);
    expect(isSlowConnection(null)).toBe(false);
  });
});
