export const SAFE_TEMPERATURE_C = 25;
export const HEAT_WARNING_TEMPERATURE_C = 30;
export function evaluateWeatherSafety(temperatureC, previouslyBlocked) {
    const heatWarning = temperatureC >= HEAT_WARNING_TEMPERATURE_C;
    const bookingBlocked = heatWarning
        ? true
        : temperatureC < SAFE_TEMPERATURE_C
            ? false
            : previouslyBlocked;
    return {
        safetyLevel: heatWarning
            ? "HEAT_WARNING"
            : temperatureC < SAFE_TEMPERATURE_C
                ? "SAFE"
                : "CAUTION",
        heatWarning,
        bookingBlocked,
    };
}
