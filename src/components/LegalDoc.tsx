'use client';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';

/* Shared layout for the legal pages (CGU, confidentialité). Fully i18n via
 * useTranslations(ns); the section STRUCTURE (paragraphs vs lists, icon) lives
 * here, the text lives in messages/{fr,en}.json under the given namespace.
 * Same dark "Atelier" design as the app + a working FR/EN toggle. */

/** A paragraph (with optional leading icon) or a bullet list. Each entry points
 *  at a message key under `s.<section>.<key>`. */
export type Block = { p: string; icon?: boolean } | { ul: string[] };
export interface SectionDef { key: string; blocks: Block[]; }

export default function LegalDoc({ ns, sections }: { ns: string; sections: SectionDef[] }) {
  const t = useTranslations(ns);
  // Rich-text tag handlers shared by every paragraph/list item.
  const rich = {
    b: (c: ReactNode) => <strong>{c}</strong>,
    mail: (c: ReactNode) => <a href="mailto:contact@suimini.app" style={{ color: 'var(--accent)' }}>{c}</a>,
    mut: (c: ReactNode) => <span style={{ color: 'var(--text-muted)' }}>{c}</span>,
  };

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', fontFamily: 'var(--font-body)', color: 'var(--text)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 48 }}>
        <a href="/" style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-mono)', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
          ← {t('back')}
        </a>
        <LanguageSwitcher />
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        {t('eyebrow')}
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, margin: '0 0 8px' }}>
        {t('title')}
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 48px', fontFamily: 'var(--font-mono)' }}>
        {t('updated')}
      </p>

      {sections.map((s, i) => (
        <section key={s.key} style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, borderBottom: '2px solid var(--ink)', paddingBottom: 8, marginBottom: 16 }}>
            {i + 1}. {t(`s.${s.key}.t`)}
          </h2>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {s.blocks.map((b, j) =>
              'ul' in b ? (
                <ul key={j} style={{ margin: 0, paddingLeft: 20 }}>
                  {b.ul.map(k => (
                    <li key={k} style={{ marginBottom: 6 }}>{t.rich(`s.${s.key}.${k}`, rich)}</li>
                  ))}
                </ul>
              ) : b.icon ? (
                <p key={j} style={{ margin: 0, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <AlertTriangle size={16} aria-hidden="true" style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 3 }} />
                  <span>{t.rich(`s.${s.key}.${b.p}`, rich)}</span>
                </p>
              ) : (
                <p key={j} style={{ margin: 0 }}>{t.rich(`s.${s.key}.${b.p}`, rich)}</p>
              )
            )}
          </div>
        </section>
      ))}
    </main>
  );
}
