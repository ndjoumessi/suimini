'use client';
import { ColorThemeId } from '@/types';
import { COLOR_THEMES } from '@/lib/themes';

interface Props {
  themeId: ColorThemeId;
  onSelectTheme: (id: ColorThemeId) => void;
  onPreviewTheme: (id: ColorThemeId) => void;
  onCancelPreview: () => void;
  dark: boolean;
  onToggleDark: () => void;
}

export default function SettingsView({ themeId, onSelectTheme, onPreviewTheme, onCancelPreview, dark, onToggleDark }: Props) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }} className="animate-fade-in">
        <h2 className="serif" style={{ margin: '0 0 4px', fontSize: '1.6rem' }}>⚙️ Paramètres</h2>
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
                    border: `2px solid ${active ? theme.accent : 'var(--border)'}`,
                    background: 'var(--bg-card)',
                    boxShadow: active ? 'var(--shadow)' : 'none',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '18px' }}>{theme.emoji}</span>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{theme.name}</span>
                    {active && (
                      <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: theme.accent }}>✓ Actif</span>
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
                        <div style={{ fontSize: '9px', color: 'var(--text-light)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{s.l}</div>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>Mode sombre</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Réduit la luminosité pour les environnements peu éclairés.</div>
            </div>
            <button onClick={onToggleDark} className="btn btn-secondary btn-sm">
              {dark ? '☀️ Passer en clair' : '🌙 Passer en sombre'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
