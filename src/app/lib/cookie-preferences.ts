export const COOKIE_PREFERENCES_STORAGE_KEY = "pawside_cookie_preferences";
export const COOKIE_PREFERENCES_UPDATED_EVENT = "pawside:cookie-preferences-updated";

export interface OptionalCookiePreferences {
  analytics: boolean;
  marketing: boolean;
}

export interface StoredCookiePreferences extends OptionalCookiePreferences {
  necessary: true;
  updatedAt: string;
}

export function readCookiePreferences(): StoredCookiePreferences | null {
  try {
    const storedValue = window.localStorage.getItem(COOKIE_PREFERENCES_STORAGE_KEY);
    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue) as Partial<StoredCookiePreferences>;
    if (
      parsedValue.necessary !== true ||
      typeof parsedValue.analytics !== "boolean" ||
      typeof parsedValue.marketing !== "boolean" ||
      typeof parsedValue.updatedAt !== "string"
    ) {
      return null;
    }

    return {
      necessary: true,
      analytics: parsedValue.analytics,
      marketing: parsedValue.marketing,
      updatedAt: parsedValue.updatedAt,
    };
  } catch {
    return null;
  }
}

export function saveCookiePreferences(
  preferences: OptionalCookiePreferences,
): StoredCookiePreferences {
  const storedPreferences: StoredCookiePreferences = {
    necessary: true,
    ...preferences,
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(
    COOKIE_PREFERENCES_STORAGE_KEY,
    JSON.stringify(storedPreferences),
  );
  window.dispatchEvent(new Event(COOKIE_PREFERENCES_UPDATED_EVENT));

  return storedPreferences;
}
