'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ColorThemeId, FamilyTree } from '@/types';
import { COLOR_THEMES } from '@/lib/themes';
import { ThemeMode } from '@/hooks/useDarkMode';
import { supabase } from '@/lib/supabase';
import { Sun, Moon, Monitor, Settings as SettingsIcon, Check, KeyRound, LogOut, Download, Trash2, ShieldAlert, Save } from 'lucide-react';

interface Props {
  themeId: ColorThemeId;
  onSelectTheme: (id: ColorThemeId) => void;
  onPreviewTheme: (id: ColorThemeId) => void;
  onCancelPreview: () => void;
  dark: boolean;
  mode: ThemeMode;
  onSetMode: (m: ThemeMode) => void;
  userEmail?: string | null;
  displayName?: string | null;
  cloud?: boolean;
  trees?: FamilyTree[];
  onToast?: (msg: string, type?: string) => void;
}

const MODE_OPTS: { id: ThemeMode; labelKey: 'modeLight' | 'modeDark' | 'modeSystem'; Icon: typeof Sun }[] = [
  { id: 'light', labelKey: 'modeLight', Icon: Sun },
  { id: 'dark', labelKey: 'modeDark', Icon: Moon },
  { id: 'system', labelKey: 'modeSystem', Icon: Monitor },
];

function clearLocalSuimini() {
  try {
    Object.keys(localStorage).filter(k => k.startsWith('suimini_')).forEach(k => localStorage.removeItem(k));
    document.cookie = 'suimini_demo=; path=/; max-age=0; samesite=lax';
  } catch { /* ignore */ }
}

function initials(name?: string | null, email?: string | null): string {
  const src = (name || email || '?').trim();
  const parts = src.split(/[\s.@_-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase().slice(0, 2);
}

export default function SettingsView({ themeId, onSelectTheme, onPreviewTheme, onCancelPreview, mode, onSetMode, userEmail, displayName, trees = [], onToast }: Props) {
  const [name, setName] = useState(displayName || '');
  const [savingName, setSavingName] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const t = useTranslations('settings');
  const toast = (m: string, type?: string) => onToast?.(m, type);

  async function saveName() {
    if (!supabase) return;
    setSavingName(true);
    const { error } = await supabase.auth.updateUser({ data: { display_name: name.trim() } });
    setSavingName(false);
    toast(error ? t('toastNameFailed') : t('toastNameUpdated'), error ? 'error' : 'success');
  }
  async function changePassword() {
    if (!supabase || !userEmail) return;
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });
    toast(error ? t('toastPasswordFailed') : t('toastPasswordSent'), error ? 'error' : 'success');
  }
  async function signOutAll() {
    if (!supabase) return;
    await supabase.auth.signOut({ scope: 'global' });
    window.location.href = '/';
  }
  function exportData() {
    const payload = { app: 'Suimini', exportedAt: new Date().toISOString(), treeCount: trees.length, trees };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suimini-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(t('toastExported'));
  }
  function clearCache() {
    if (!window.confirm(t('confirmClearCache'))) return;
    clearLocalSuimini();
    window.location.href = '/';
  }
  async function deleteAccount() {
    if (confirmText.trim() !== t('deleteConfirmPlaceholder').trim()) return;
    setBusy(true);
    try { await supabase?.rpc('delete_account'); } catch { /* server fn may not exist; proceed best-effort */ }
    try { await supabase?.auth.signOut({ scope: 'global' }); } catch { /* ignore */ }
    clearLocalSuimini();
    window.location.href = '/';
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }} className="animate-fade-in">
        <h2 className="serif" style={{ margin: '0 0 4px', fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SettingsIcon size={22} style={{ color: 'var(--accent)', flexShrink: 0 }} aria-hidden="true" />
          {t('title')}
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '28px' }}>
          {t('subtitle')}
        </p>

        {/* Theme picker */}
        <section style={{ marginBottom: '32px' }}>
          <h3 className="serif" style={{ fontSize: '1.15rem', marginBottom: '4px' }}>{t('colorTheme')}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
            {t('colorThemeHint')}
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
                    <span aria-hidden="true" style={{ width: '16px', height: '16px', borderRadius: '50%', background: theme.accent, border: '1px solid var(--border)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{theme.name}</span>
                    {active && (
                      <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: theme.accent, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Check size={12} aria-hidden="true" /> {t('active')}</span>
                    )}
                  </div>
                  {/* Swatches */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[
                      { c: theme.accent, k: 'accent', l: t('swatchAccent') },
                      { c: theme.male, k: 'male', l: t('swatchMale') },
                      { c: theme.female, k: 'female', l: t('swatchFemale') },
                    ].map(s => (
                      <div key={s.k} style={{ flex: 1 }}>
                        <div style={{ height: '28px', borderRadius: '6px', background: s.c, marginBottom: '4px' }} />
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>{s.l}</div>
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
          <h3 className="serif" style={{ fontSize: '1.15rem', marginBottom: '12px' }}>{t('appearance')}</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>{t('displayTheme')}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('displayThemeHint')}</div>
            </div>
            <div role="radiogroup" aria-label={t('displayTheme')} style={{ display: 'inline-flex', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '3px', gap: '2px' }}>
              {MODE_OPTS.map(opt => {
                const active = mode === opt.id;
                return (
                  <button key={opt.id} role="radio" aria-checked={active} onClick={() => onSetMode(opt.id)}
                    className="btn btn-sm" style={{
                      background: active ? 'var(--accent)' : 'transparent',
                      color: active ? '#fff' : 'var(--text-muted)',
                      boxShadow: 'none', minHeight: '32px',
                    }}>
                    <opt.Icon size={14} /> {t(opt.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Account (signed-in only) */}
        {userEmail && (
          <section style={{ marginTop: '32px' }}>
            <h3 className="serif" style={{ fontSize: '1.15rem', marginBottom: '12px' }}>{t('account')}</h3>
            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div aria-hidden="true" style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '15px', flexShrink: 0 }}>
                  {initials(name, userEmail)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || userEmail.split('@')[0]}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
                </div>
              </div>

              <div>
                <label className="label" htmlFor="settings-display-name" style={{ display: 'block', marginBottom: '6px' }}>{t('displayName')}</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input id="settings-display-name" className="input" style={{ flex: 1, minWidth: '180px' }} value={name} onChange={e => setName(e.target.value)} placeholder={t('displayNamePlaceholder')} />
                  <button className="btn btn-secondary btn-sm" style={{ gap: '6px' }} onClick={saveName} disabled={savingName || name.trim() === (displayName || '').trim()}>
                    <Save size={14} aria-hidden="true" /> {savingName ? t('saving') : t('save')}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" style={{ gap: '6px' }} onClick={changePassword}>
                  <KeyRound size={14} aria-hidden="true" /> {t('changePassword')}
                </button>
                <button className="btn btn-secondary btn-sm" style={{ gap: '6px' }} onClick={signOutAll}>
                  <LogOut size={14} aria-hidden="true" /> {t('signOutAll')}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Data */}
        <section style={{ marginTop: '32px' }}>
          <h3 className="serif" style={{ fontSize: '1.15rem', marginBottom: '4px' }}>{t('data')}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>
            {t('dataHint')}
          </p>
          <div className="card" style={{ padding: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" style={{ gap: '6px' }} onClick={exportData} disabled={trees.length === 0}>
              <Download size={14} aria-hidden="true" /> {t('exportAll')}{trees.length ? ` (${trees.length})` : ''}
            </button>
            <button className="btn btn-secondary btn-sm" style={{ gap: '6px' }} onClick={clearCache}>
              <Trash2 size={14} aria-hidden="true" /> {t('clearCache')}
            </button>
          </div>
        </section>

        {/* Danger zone (signed-in only) */}
        {userEmail && (
          <section style={{ marginTop: '32px' }}>
            <h3 className="serif" style={{ fontSize: '1.15rem', marginBottom: '4px', color: 'var(--danger)' }}>{t('dangerZone')}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>
              {t('dangerHint')}
            </p>
            <div className="card" style={{ padding: '16px', border: '1px solid var(--danger)' }}>
              {!deleteOpen ? (
                <button className="btn btn-danger btn-sm" style={{ gap: '6px' }} onClick={() => setDeleteOpen(true)}>
                  <ShieldAlert size={14} aria-hidden="true" /> {t('deleteAccount')}
                </button>
              ) : (
                <div className="animate-fade-in">
                  <p style={{ fontSize: '13px', margin: '0 0 8px' }}>
                    {t.rich('deleteIrreversible', { keyword: () => <strong>{t('deleteConfirmPlaceholder')}</strong> })}
                  </p>
                  <input className="input" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder={t('deleteConfirmPlaceholder')} aria-label={t('deleteConfirmAria')} style={{ marginBottom: '10px', maxWidth: '260px' }} />
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn btn-danger btn-sm" onClick={deleteAccount} disabled={confirmText.trim() !== t('deleteConfirmPlaceholder').trim() || busy}>
                      {busy ? t('deleting') : t('deletePermanent')}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setDeleteOpen(false); setConfirmText(''); }}>{t('cancel')}</button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
