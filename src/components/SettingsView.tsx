'use client';
import { ColorThemeId } from '@/types';
import { COLOR_THEMES } from '@/lib/themes';
import { ThemeMode } from '@/hooks/useDarkMode';
import { Sun, Moon, Monitor, Settings as SettingsIcon, Check } from 'lucide-react';

interface Props {
  themeId: ColorThemeId;
  onSelectTheme: (id: ColorThemeId) => void;
  onPreviewTheme: (id: ColorThemeId) => void;
  onCancelPreview: () => void;
  dark: boolean;
  mode: ThemeMode;
  onSetMode: (m: ThemeMode) => void;
}

const MODE_OPTS: { id: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { id: 'light', label: 'Clair', Icon: Sun },
  { id: 'dark', label: 'Sombre', Icon: Moon },
  { id: 'system', label: 'Système', Icon: Monitor },
];

export default function SettingsView({ themeId, onSelectTheme, onPreviewTheme, onCancelPreview, mode, onSetMode }: Props) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }} className="animate-fade-in">
        <h2 className="serif" style={{ margin: '0 0 4px', fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SettingsIcon size={22} style={{ color: 'var(--accent)', flexShrink: 0 }} aria-hidden="true" />
          Paramètres
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '28px' }}>
          Personnalisez l&apos;apparence de Suimini. Vos préférences sont enregistrées sur cet appareil.
        </p>

        {/* Theme picker */}
        <section style={{ marginBottom: '32px' }}>
          <h3 className="serif" style={{ fontSize: '1.15rem', marginBottom: '4px' }}>Thème de couleurs</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
            Survolez un thème pour l&apos;aperçu en temps réel, cliquez pour l&apos;appliquer.
          </p>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}
            onMouseLeave={onCancelPreview}
          >
            {COLOR_THEMES.map(theme => {
              const active = theme.id === themeId;
              return (
                <button
                  key={theme.id}
                  onClick={() => onSelectTheme(theme.id)}
                  onMouseEnter={() => onPreviewTheme(theme.id)}
                  style={{
                    textAlign: 'left', cursor: 'pointer', padding: '14px',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    boxShadow: active ? `0 0 0 2px ${theme.accent}, var(--shadow)` : 'none',
                    transition: 'box-shadow var(--t-fast) var(--ease-out)',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '18px' }}>{theme.emoji}</span>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{theme.name}</span>
                    {active && (
                      <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: theme.accent, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Check size={12} aria-hidden="true" /> Actif</span>
                    )}
                  </div>
                  {/* Swatches */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[
                      { c: theme.accent, l: 'Accent' },
                      { c: theme.male, l: 'Homme' },
                      { c: theme.female, l: 'Femme' },
                    ].map(s => (
                      <div key={s.l} style={{ flex: 1 }}>
                        <div style={{ height: '28px', borderRadius: '6px', background: s.c, marginBottom: '4px' }} />
                        <div style={{ fontSize: '10px', color: 'var(--text-light)', textAlign: 'center' }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Appearance */}
        <section>
          <h3 className="serif" style={{ fontSize: '1.15rem', marginBottom: '12px' }}>Apparence</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>Thème d&apos;affichage</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>« Système » suit automatiquement les réglages de votre appareil.</div>
            </div>
            <div role="radiogroup" aria-label="Thème d'affichage" style={{ display: 'inline-flex', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '3px', gap: '2px' }}>
              {MODE_OPTS.map(opt => {
                const active = mode === opt.id;
                return (
                  <button key={opt.id} role="radio" aria-checked={active} onClick={() => onSetMode(opt.id)}
                    className="btn btn-sm" style={{
                      background: active ? 'var(--accent)' : 'transparent',
                      color: active ? '#fff' : 'var(--text-muted)',
                      boxShadow: 'none', minHeight: '32px',
                    }}>
                    <opt.Icon size={14} /> {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
