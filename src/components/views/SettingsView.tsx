'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ColorThemeId, FamilyTree } from '@/types';
import { COLOR_THEMES } from '@/lib/themes';
import { supabase } from '@/lib/supabase';
import { relativeSyncParts } from '@/lib/relativeTime';
import { Settings as SettingsIcon, Check, KeyRound, LogOut, Download, Trash2, ShieldAlert, Save, RefreshCw } from 'lucide-react';

interface Props {
  themeId: ColorThemeId;
  onSelectTheme: (id: ColorThemeId) => void;
  onPreviewTheme: (id: ColorThemeId) => void;
  onCancelPreview: () => void;
  userEmail?: string | null;
  displayName?: string | null;
  cloud?: boolean;
  trees?: FamilyTree[];
  onToast?: (msg: string, type?: string) => void;
  /** Force a full resync from Supabase (wipes the local cache first). */
  onResync?: () => void | Promise<void>;
  lastSyncAt?: number | null;
}

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

export default function SettingsView({ themeId, onSelectTheme, onPreviewTheme, onCancelPreview, userEmail, displayName, cloud, trees = [], onToast, onResync, lastSyncAt }: Props) {
  const [name, setName] = useState(displayName || '');
  const [resyncing, setResyncing] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const t = useTranslations('settings');
  const tSync = useTranslations('sync');
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
      <style>{`
        .set-theme-card { transition: border-color var(--t-fast) var(--ease-out), box-shadow var(--t-base) var(--ease-out), transform var(--t-fast) var(--ease-out); }
        .set-theme-card:hover { border-color: var(--accent); box-shadow: var(--shadow-accent); transform: translateY(-2px); }
        .set-theme-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .set-rule { border: none; border-top: 1px solid var(--accent-light); margin: 0 0 28px; }
        @media (prefers-reduced-motion: reduce) { .set-theme-card { transition: border-color var(--t-fast) ease; } .set-theme-card:hover { transform: none; } }
      `}</style>
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
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}
            onMouseLeave={onCancelPreview}
          >
            {COLOR_THEMES.map(theme => {
              const active = theme.id === themeId;
              return (
                <button
                  key={theme.id}
                  onClick={() => onSelectTheme(theme.id)}
                  onMouseEnter={() => onPreviewTheme(theme.id)}
                  className="set-theme-card"
                  aria-pressed={active}
                  style={{
                    textAlign: 'left', cursor: 'pointer', padding: '18px',
                    border: active ? `2px solid ${theme.accent}` : '1px solid var(--border)',
                    background: active ? '#252535' : 'var(--bg-card)',
                    boxShadow: 'none',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '14px' }}>
                    <span aria-hidden="true" style={{ width: '18px', height: '18px', borderRadius: '50%', background: theme.accent, border: '1px solid var(--border)', flexShrink: 0 }} />
                    <span className="serif" style={{ fontWeight: 600, fontSize: '15px' }}>{theme.name}</span>
                    {active && (
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#0d0d0d', background: theme.accent, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Check size={11} aria-hidden="true" /> {t('active')}</span>
                    )}
                  </div>
                  {/* Swatches */}
                  <div style={{ display: 'flex', gap: '7px' }}>
                    {[
                      { c: theme.accent, k: 'accent', l: t('swatchAccent') },
                      { c: theme.male, k: 'male', l: t('swatchMale') },
                      { c: theme.female, k: 'female', l: t('swatchFemale') },
                    ].map(s => (
                      <div key={s.k} style={{ flex: 1 }}>
                        <div style={{ height: '34px', borderRadius: 0, background: s.c, marginBottom: '5px' }} />
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'center' }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Account (signed-in only) */}
        {userEmail && (
          <section style={{ marginTop: '32px' }}>
            <hr className="set-rule" />
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
          <hr className="set-rule" />
          <h3 className="serif" style={{ fontSize: '1.15rem', marginBottom: '4px' }}>{t('data')}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>
            {t('dataHint')}
          </p>
          <div className="card" style={{ padding: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {cloud && onResync && (
              <button
                className="btn btn-secondary btn-sm" style={{ gap: '6px' }} disabled={resyncing}
                onClick={async () => { setResyncing(true); try { await onResync(); } finally { setResyncing(false); } }}
              >
                <RefreshCw size={14} aria-hidden="true" style={{ animation: resyncing ? 'spin 0.8s linear infinite' : undefined }} />
                {resyncing ? tSync('resyncing') : tSync('resync')}
              </button>
            )}
            <button className="btn btn-secondary btn-sm" style={{ gap: '6px' }} onClick={exportData} disabled={trees.length === 0}>
              <Download size={14} aria-hidden="true" /> {t('exportAll')}{trees.length ? ` (${trees.length})` : ''}
            </button>
            <button className="btn btn-sm" style={{ gap: '6px', background: 'transparent', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={clearCache}>
              <Trash2 size={14} aria-hidden="true" /> {t('clearCache')}
            </button>
          </div>
          {cloud && lastSyncAt != null && (() => {
            const { key, count } = relativeSyncParts(lastSyncAt);
            const time = count != null ? tSync(key, { count }) : tSync(key);
            return (
              <p style={{ color: 'var(--text-light)', fontSize: '12px', marginTop: '8px' }}>
                {tSync('lastSync', { time })}
              </p>
            );
          })()}
        </section>

        {/* Danger zone (signed-in only) */}
        {userEmail && (
          <section style={{ marginTop: '32px' }}>
            <hr className="set-rule" />
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
