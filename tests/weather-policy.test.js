import { describe, expect, test } from '@jest/globals';

const { evaluateWeatherSafety } = await import(
  '../backend/src/weather/weather-policy.js'
);

describe('weather booking safety policy', () => {
  test('keeps booking available below 25°C', () => {
    expect(evaluateWeatherSafety(24.9, true)).toEqual({
      safetyLevel: 'SAFE',
      heatWarning: false,
      bookingBlocked: false,
    });
  });

  test('blocks booking and warns at 30°C or above', () => {
    expect(evaluateWeatherSafety(30, false)).toEqual({
      safetyLevel: 'HEAT_WARNING',
      heatWarning: true,
      bookingBlocked: true,
    });
  });

  test('uses hysteresis between 25°C and 30°C', () => {
    expect(evaluateWeatherSafety(27, true).bookingBlocked).toBe(true);
    expect(evaluateWeatherSafety(27, false).bookingBlocked).toBe(false);
  });
});
