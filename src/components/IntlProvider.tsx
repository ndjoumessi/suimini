'use client';
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { MESSAGES } from '@/i18n/messages';
import { LOCALE_COOKIE, type Locale } from '@/i18n/config';

interface LocaleSwitch {
  locale: Locale;
  setLocale: (next: Locale) => void;
}
const Ctx = createContext<LocaleSwitch | null>(null);

/** Switch the active locale in real time (state change → instant re-render). */
export function useLocaleSwitch(): LocaleSwitch {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLocaleSwitch must be used within IntlProvider');
  return c;
}

/**
 * Client i18n provider with switchable messages. The server seeds `initialLocale`
 * from the NEXT_LOCALE cookie (so SSR + first paint are correct); afterwards the
 * locale lives in React state. Changing it re-renders every useTranslations()
 * consumer instantly — no reload, no navigation, context preserved. The cookie is
 * updated in the background so the next visit / SSR uses the chosen language.
 */
export default function IntlProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLoc] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLoc(next);
    try { localStorage.setItem(LOCALE_COOKIE, next); } catch { /* ignore */ }
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    try { document.documentElement.lang = next; } catch { /* ignore */ }
  }, []);

  return (
    <Ctx.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
        {children}
      </NextIntlClientProvider>
    </Ctx.Provider>
  );
}
