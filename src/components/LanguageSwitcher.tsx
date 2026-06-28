'use client';
import { useTranslations } from 'next-intl';
import { LOCALES, type Locale } from '@/i18n/config';
import { useLocaleSwitch } from '@/components/IntlProvider';

/**
 * FR | EN segmented toggle, Atelier style. Switches the locale in real time via
 * IntlProvider (state change → instant re-render, no reload). The cookie is
 * updated in the background for the next visit.
 */
export default function LanguageSwitcher({ tone = 'app' }: { tone?: 'app' | 'landing' }) {
  const { locale, setLocale } = useLocaleSwitch();
  const t = useTranslations('language');

  function choose(next: Locale) {
    if (next === locale) return;
    setLocale(next);
  }

  const ink = tone === 'landing' ? '#1b1b1b' : 'var(--border-strong)';
  const accent = tone === 'landing' ? '#bf4b2c' : 'var(--accent)';

  return (
    <div
      role="group"
      aria-label={t('label')}
      style={{ display: 'inline-flex', border: `1.5px solid ${ink}`, borderRadius: 0, overflow: 'hidden', background: tone === 'landing' ? '#fbf9f4' : 'var(--bg-card)' }}
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
