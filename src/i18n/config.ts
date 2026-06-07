// Shared i18n constants — safe to import from both server and client code
// (no next/headers here, unlike request.ts).
export const LOCALE_COOKIE = 'NEXT_LOCALE';
export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
