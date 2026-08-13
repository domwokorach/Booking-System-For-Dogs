import { useEffect, useState } from "react";
import {
  COOKIE_PREFERENCES_STORAGE_KEY,
  COOKIE_PREFERENCES_UPDATED_EVENT,
  readCookiePreferences,
  saveCookiePreferences,
} from "../lib/cookie-preferences";

interface CookieConsentPopupProps {
  hidden?: boolean;
  onCustomise: () => void;
}

export function CookieConsentPopup({
  hidden = false,
  onCustomise,
}: CookieConsentPopupProps) {
  const [isOpen, setIsOpen] = useState(() => readCookiePreferences() === null);

  useEffect(() => {
    function syncVisibility() {
      setIsOpen(readCookiePreferences() === null);
    }

    function handleStorageChange(event: StorageEvent) {
      if (event.key === COOKIE_PREFERENCES_STORAGE_KEY) {
        syncVisibility();
      }
    }

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(COOKIE_PREFERENCES_UPDATED_EVENT, syncVisibility);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(COOKIE_PREFERENCES_UPDATED_EVENT, syncVisibility);
    };
  }, []);

  function acceptAll() {
    saveCookiePreferences({ analytics: true, marketing: true });
    setIsOpen(false);
  }

  function declineOptional() {
    saveCookiePreferences({ analytics: false, marketing: false });
    setIsOpen(false);
  }

  if (!isOpen || hidden) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-4 sm:p-6">
      <section
        role="dialog"
        aria-labelledby="cookie-consent-title"
        aria-describedby="cookie-consent-description"
        className="mx-auto max-w-4xl rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-8"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Your privacy
            </p>
            <h2
              id="cookie-consent-title"
              className="mt-2 font-serif text-2xl font-bold text-foreground"
            >
              Select your cookie preferences
            </h2>
            <p
              id="cookie-consent-description"
              className="mt-3 text-sm leading-6 text-muted-foreground"
            >
              Pawside uses essential storage for security and bookings. You can also
              allow optional analytics and marketing technologies, decline them, or
              customise your choice.
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <button
              type="button"
              onClick={acceptAll}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={declineOptional}
              className="rounded-xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={onCustomise}
              className="rounded-xl border border-primary px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              Customise
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
