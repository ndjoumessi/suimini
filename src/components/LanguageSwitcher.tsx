'use client';
import { useLocale } from 'next-intl';
import { LOCALE_COOKIE, LOCALES, type Locale } from '@/i18n/config';

/**
 * FR | EN segmented toggle, Atelier style. No URL routing: it writes the locale
 * to a cookie (read server-side by next-intl) + localStorage (so the choice is
 * remembered), then reloads so the whole tree re-renders in the new language.
 */
export default function LanguageSwitcher({ tone = 'app' }: { tone?: 'app' | 'landing' }) {
  const locale = useLocale();

  function choose(next: Locale) {
    if (next === locale) return;
    try { localStorage.setItem(LOCALE_COOKIE, next); } catch { /* ignore */ }
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }

  const ink = tone === 'landing' ? '#1b1b1b' : 'var(--border-strong)';
  const accent = tone === 'landing' ? '#bf4b2c' : 'var(--accent)';

  return (
    <div
      role="group"
      aria-label="Language"
      style={{ display: 'inline-flex', border: `1.5px solid ${ink}`, borderRadius: '6px', overflow: 'hidden', background: tone === 'landing' ? '#fbf9f4' : 'var(--bg-card)' }}
    >
      {LOCALES.map((l, i) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            onClick={() => choose(l)}
            aria-pressed={active}
            aria-label={l === 'fr' ? 'Français' : 'English'}
            style={{
              appearance: 'none', cursor: active ? 'default' : 'pointer',
              border: 'none', borderLeft: i > 0 ? `1.5px solid ${ink}` : 'none',
              padding: '4px 9px', fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px',
              background: active ? accent : 'transparent',
              color: active ? '#fff' : (tone === 'landing' ? '#6e6a62' : 'var(--text-muted)'),
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
          >
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
