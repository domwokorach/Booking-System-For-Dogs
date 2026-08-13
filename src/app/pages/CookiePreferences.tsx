import { useState } from "react";

const COOKIE_PREFERENCES_STORAGE_KEY = "pawside_cookie_preferences";

interface CookiePreferencesProps {
  onNavigateHome: () => void;
}

interface OptionalCookiePreferences {
  analytics: boolean;
  marketing: boolean;
}

interface StoredCookiePreferences extends OptionalCookiePreferences {
  necessary: true;
  updatedAt: string;
}

function readCookiePreferences(): OptionalCookiePreferences {
  try {
    const storedValue = window.localStorage.getItem(COOKIE_PREFERENCES_STORAGE_KEY);
    if (!storedValue) {
      return { analytics: false, marketing: false };
    }

    const parsedValue = JSON.parse(storedValue) as Partial<StoredCookiePreferences>;
    return {
      analytics: parsedValue.analytics === true,
      marketing: parsedValue.marketing === true,
    };
  } catch {
    return { analytics: false, marketing: false };
  }
}

export function CookiePreferences({ onNavigateHome }: CookiePreferencesProps) {
  const [preferences, setPreferences] = useState<OptionalCookiePreferences>(
    readCookiePreferences,
  );
  const [showCustomisation, setShowCustomisation] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  function savePreferences(
    nextPreferences: OptionalCookiePreferences,
    message: string,
  ) {
    const storedPreferences: StoredCookiePreferences = {
      necessary: true,
      ...nextPreferences,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(
      COOKIE_PREFERENCES_STORAGE_KEY,
      JSON.stringify(storedPreferences),
    );
    setPreferences(nextPreferences);
    setConfirmation(message);
  }

  function acceptAll() {
    savePreferences(
      { analytics: true, marketing: true },
      "All cookie preferences have been accepted.",
    );
  }

  function declineOptional() {
    savePreferences(
      { analytics: false, marketing: false },
      "Optional cookies have been declined. Essential storage remains enabled.",
    );
  }

  function saveCustomPreferences() {
    savePreferences(preferences, "Your custom cookie preferences have been saved.");
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background px-6 py-14 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={onNavigateHome}
          className="mb-8 text-sm font-semibold text-primary transition-colors hover:text-foreground"
        >
          ← Back to Pawside
        </button>

        <section className="rounded-3xl border border-border bg-card p-7 shadow-sm sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Your privacy
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold text-foreground sm:text-5xl">
            Cookie Preferences
          </h1>
          <p className="mt-6 max-w-3xl leading-7 text-muted-foreground">
            Select your cookie preferences. Essential storage keeps Pawside secure and
            remembers choices such as your session and cookie settings. Optional
            categories can be accepted, declined, or customised at any time.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={acceptAll}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={declineOptional}
              className="rounded-xl border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCustomisation((currentValue) => !currentValue);
                setConfirmation(null);
              }}
              aria-expanded={showCustomisation}
              aria-controls="custom-cookie-preferences"
              className="rounded-xl border border-primary px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              Customise
            </button>
          </div>

          {confirmation ? (
            <p
              role="status"
              aria-live="polite"
              className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              {confirmation}
            </p>
          ) : null}

          {showCustomisation ? (
            <div id="custom-cookie-preferences" className="mt-8 space-y-4">
              <div className="flex items-start justify-between gap-6 rounded-2xl border border-border bg-background p-5">
                <div>
                  <h2 className="font-semibold text-foreground">Essential</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Required for security, account sessions, bookings, and remembering
                    your cookie choices. These cannot be switched off.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Always on
                </span>
              </div>

              <CookiePreferenceToggle
                id="analytics-cookies"
                title="Analytics"
                description="Helps Pawside understand how visitors use the website so the experience can be improved."
                checked={preferences.analytics}
                onChange={(checked) =>
                  setPreferences((currentValue) => ({
                    ...currentValue,
                    analytics: checked,
                  }))
                }
              />

              <CookiePreferenceToggle
                id="marketing-cookies"
                title="Marketing"
                description="Allows relevant Pawside promotions to be measured or personalised where marketing tools are used."
                checked={preferences.marketing}
                onChange={(checked) =>
                  setPreferences((currentValue) => ({
                    ...currentValue,
                    marketing: checked,
                  }))
                }
              />

              <button
                type="button"
                onClick={saveCustomPreferences}
                className="w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:w-auto"
              >
                Save preferences
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

interface CookiePreferenceToggleProps {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function CookiePreferenceToggle({
  id,
  title,
  description,
  checked,
  onChange,
}: CookiePreferenceToggleProps) {
  return (
    <div className="flex items-start justify-between gap-6 rounded-2xl border border-border bg-background p-5">
      <div>
        <label htmlFor={id} className="font-semibold text-foreground">
          {title}
        </label>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-primary"
      />
    </div>
  );
}
