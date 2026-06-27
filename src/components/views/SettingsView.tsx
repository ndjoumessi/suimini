'use client';
import { useState, useRef, type ReactNode } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { ColorThemeId, FamilyTree } from '@/types';
import { COLOR_THEMES } from '@/lib/themes';
import { supabase } from '@/lib/supabase';
import { relativeSyncParts } from '@/lib/relativeTime';
import { LOCALE_COOKIE, LOCALES, type Locale } from '@/i18n/config';
import { Settings2, Check, KeyRound, LogOut, Download, Trash2, RefreshCw, Cloud, CloudOff, X, Pencil } from 'lucide-react';

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

/** Mono tiny uppercase section eyebrow (gold-muted, or red for the danger zone). */
function Eyebrow({ children, danger }: { children: ReactNode; danger?: boolean }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: danger ? 'var(--danger)' : 'var(--accent-text)', marginBottom: '8px' }}>
      {children}
    </div>
  );
}

export default function SettingsView({ themeId, onSelectTheme, onPreviewTheme, onCancelPreview, userEmail, displayName, cloud, trees = [], onToast, onResync, lastSyncAt }: Props) {
  const [name, setName] = useState(displayName || '');
  const [resyncing, setResyncing] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const t = useTranslations('settings');
  const tSync = useTranslations('sync');
  const locale = useLocale();
  const toast = (m: string, type?: string) => onToast?.(m, type);
  const deleteWord = t('deleteConfirmPlaceholder');

  function chooseLocale(next: Locale) {
    // No `next === locale` guard (useLocale() can read stale by one navigation).
    try { localStorage.setItem(LOCALE_COOKIE, next); } catch { /* ignore */ }
    const back = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/app';
    window.location.href = `/api/locale?to=${next}&next=${encodeURIComponent(back)}`;
  }

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
    if (confirmText.trim() !== deleteWord.trim()) return;
    setBusy(true);
    try { await supabase?.rpc('delete_account'); } catch { /* server fn may not exist; proceed best-effort */ }
    try { await supabase?.auth.signOut({ scope: 'global' }); } catch { /* ignore */ }
    clearLocalSuimini();
    window.location.href = '/';
  }

  return (
    <div className="set-root" style={{ flex: 1, overflowY: 'auto' }}>
      <div className="set-wrap animate-fade-in">
        {/* Hero */}
        <header className="set-hero">
          <Settings2 size={24} aria-hidden="true" style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <h1 className="serif set-title">{t('title')}</h1>
            <p className="set-subtitle">{t('subtitle')}</p>
          </div>
        </header>

        {/* SECTION 1 — Profile */}
        {userEmail && (
          <section className="set-section">
            <Eyebrow>{t('account')}</Eyebrow>
            <div className="set-card">
              <div className="set-profile-head">
                <span className="set-avatar" aria-hidden="true">{initials(name, userEmail)}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="serif set-profile-name">{name || userEmail.split('@')[0]}</div>
                  <div className="set-profile-email">{userEmail}</div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ gap: '6px', flexShrink: 0 }} onClick={() => nameRef.current?.focus()}>
                  <Pencil size={13} aria-hidden="true" /> {t('editProfile')}
                </button>
              </div>

              <div className="set-field">
                <label className="set-flabel" htmlFor="settings-display-name">{t('displayName')}</label>
                <div className="set-field-row">
                  <input ref={nameRef} id="settings-display-name" className="set-input" value={name} onChange={e => setName(e.target.value)} placeholder={t('displayNamePlaceholder')} />
                  <button className="btn btn-primary btn-sm" style={{ gap: '6px', flexShrink: 0 }} onClick={saveName} disabled={savingName || name.trim() === (displayName || '').trim()}>
                    {savingName ? <span className="spinner" /> : <Check size={14} aria-hidden="true" />} {savingName ? t('saving') : t('save')}
                  </button>
                </div>
              </div>

              <div className="set-account-actions">
                <button className="btn btn-ghost btn-sm" style={{ gap: '6px' }} onClick={changePassword}>
                  <KeyRound size={14} aria-hidden="true" /> {t('changePassword')}
                </button>
                <span className="set-vrule" aria-hidden="true" />
                <button className="btn btn-ghost btn-sm" style={{ gap: '6px' }} onClick={signOutAll}>
                  <LogOut size={14} aria-hidden="true" /> {t('signOutAll')}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 2 — Accent colour */}
        <section className="set-section">
          <Eyebrow>{t('appearance')}</Eyebrow>
          <p className="set-section-sub">{t('colorThemeHint')}</p>
          <div className="set-themes" onMouseLeave={onCancelPreview}>
            {COLOR_THEMES.map(theme => {
              const active = theme.id === themeId;
              return (
                <button
                  key={theme.id}
                  onClick={() => onSelectTheme(theme.id)}
                  onMouseEnter={() => onPreviewTheme(theme.id)}
                  className={`set-theme-card ${active ? 'on' : ''}`}
                  aria-pressed={active}
                  style={active ? { borderColor: 'var(--accent)' } : undefined}
                >
                  <div className="set-theme-top">
                    <span className="set-theme-name">{theme.name}</span>
                    {active && <span className="set-theme-badge"><Check size={10} aria-hidden="true" /> {t('active')}</span>}
                  </div>
                  <div className="set-theme-pastilles">
                    {[theme.accent, theme.male, theme.female].map((c, i) => (
                      <span key={i} style={{ background: c }} aria-hidden="true" />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* SECTION 3 — Language */}
        <section className="set-section">
          <Eyebrow>{t('language')}</Eyebrow>
          <div className="set-lang" role="group" aria-label={t('language')}>
            {LOCALES.map(l => {
              const on = l === locale;
              return (
                <button key={l} type="button" onClick={() => chooseLocale(l)} aria-pressed={on}
                  className={`set-lang-btn ${on ? 'on' : ''}`}>
                  {l === 'fr' ? 'Français' : 'English'}
                </button>
              );
            })}
          </div>
        </section>

        {/* SECTION 4 — Data & sync */}
        <section className="set-section">
          <Eyebrow>{t('data')}</Eyebrow>
          <p className="set-section-sub">{t('dataHint')}</p>
          <div className="set-card">
            <ul className="set-data-info">
              {cloud && lastSyncAt != null && (() => {
                const { key, count } = relativeSyncParts(lastSyncAt);
                const time = count != null ? tSync(key, { count }) : tSync(key);
                return <li>{tSync('lastSync', { time })}</li>;
              })()}
              <li>{t('syncedTrees', { count: trees.length })}</li>
              <li style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {cloud ? <Cloud size={12} aria-hidden="true" style={{ color: 'var(--success)' }} /> : <CloudOff size={12} aria-hidden="true" style={{ color: 'var(--text-light)' }} />}
                {cloud ? t('cloudActive') : t('localMode')}
              </li>
            </ul>
            <div className="set-data-actions">
              {cloud && onResync && (
                <button className="btn btn-ghost btn-sm" style={{ gap: '6px' }} disabled={resyncing}
                  onClick={async () => { setResyncing(true); try { await onResync(); } finally { setResyncing(false); } }}>
                  <RefreshCw size={14} aria-hidden="true" style={{ animation: resyncing ? 'spin 0.8s linear infinite' : undefined }} />
                  {resyncing ? tSync('resyncing') : tSync('resync')}
                </button>
              )}
              <button className="btn btn-ghost btn-sm" style={{ gap: '6px' }} onClick={exportData} disabled={trees.length === 0}>
                <Download size={14} aria-hidden="true" /> {t('exportAll')}{trees.length ? ` (${trees.length})` : ''}
              </button>
              <button className="btn btn-ghost btn-sm set-danger-ghost" style={{ gap: '6px' }} onClick={clearCache}>
                <Trash2 size={14} aria-hidden="true" /> {t('clearCache')}
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 5 — Danger zone */}
        {userEmail && (
          <section className="set-section">
            <Eyebrow danger>{t('dangerZone')}</Eyebrow>
            <div className="set-danger-card">
              <p className="set-danger-text">{t('dangerHint')}</p>
              <button className="btn btn-sm set-danger-btn" style={{ gap: '6px' }} onClick={() => { setDeleteOpen(true); setConfirmText(''); }}>
                <Trash2 size={14} aria-hidden="true" /> {t('deleteAccount')}
              </button>
            </div>
          </section>
        )}

        {/* SECTION 6 — About */}
        <section className="set-section set-section-last">
          <Eyebrow>{t('about')}</Eyebrow>
          <div className="set-card set-about">
            <div className="set-about-version">Suimini v1.5</div>
            <p className="set-about-tagline">{t('aboutTagline')}</p>
            <div className="set-about-links">
              <a href="/cgu">{t('linkTerms')}</a>
              <span aria-hidden="true">·</span>
              <a href="/confidentialite">{t('linkPrivacy')}</a>
              <span aria-hidden="true">·</span>
              <a href="mailto:contact@suimini.app">{t('linkContact')}</a>
            </div>
          </div>
        </section>
      </div>

      {/* Delete-account confirmation modal */}
      {deleteOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={t('deleteTitle')} className="modal" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: 'var(--bw) solid var(--border-strong)' }}>
              <h2 className="serif" style={{ margin: 0, fontSize: '1.1rem', color: 'var(--danger)' }}>{t('deleteTitle')}</h2>
              <button onClick={() => setDeleteOpen(false)} aria-label={t('cancel')} className="btn btn-ghost btn-sm btn-icon"><X size={16} /></button>
            </div>
            <div style={{ padding: '18px 20px 20px' }}>
              <p style={{ fontSize: '13px', lineHeight: 1.6, margin: '0 0 14px', color: 'var(--text)' }}>
                {t.rich('deleteIrreversible', { keyword: () => <strong style={{ color: 'var(--danger)' }}>{deleteWord}</strong> })}
              </p>
              <input className="set-input" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder={deleteWord} aria-label={t('deleteConfirmAria')} autoFocus style={{ marginBottom: '14px' }} />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setDeleteOpen(false); setConfirmText(''); }}>{t('cancel')}</button>
                <button className="btn btn-danger btn-sm" onClick={deleteAccount} disabled={confirmText.trim() !== deleteWord.trim() || busy}>
                  {busy ? t('deleting') : t('deletePermanent')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .set-wrap { max-width: 760px; margin: 0 auto; padding: 0 24px; }
        .set-hero { display: flex; align-items: flex-start; gap: 14px; padding: 40px 0 28px; border-bottom: 1px solid var(--accent-light); }
        .set-title { margin: 0; font-size: clamp(2rem, 4vw, 2.5rem); line-height: 1.05; color: var(--ink); letter-spacing: -0.02em; }
        .set-subtitle { margin: 6px 0 0; font-size: 15px; color: var(--text-muted); }

        .set-section { padding: 36px 0; border-bottom: 1px solid var(--border); }
        .set-section-last { border-bottom: none; }
        .set-section-sub { margin: 0 0 16px; font-size: 13px; color: var(--text-muted); }

        .set-card { background: var(--bg-card); border: 1px solid var(--border); padding: 18px; display: flex; flex-direction: column; gap: 18px; }

        /* Profile */
        .set-profile-head { display: flex; align-items: center; gap: 14px; }
        .set-avatar { width: 64px; height: 64px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--accent); color: #12131a; font-family: var(--font-display); font-weight: 700; font-size: 22px; }
        .set-profile-name { font-size: 18px; font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .set-profile-email { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .set-field { display: flex; flex-direction: column; gap: 7px; }
        .set-flabel { font-family: var(--font-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent-text); }
        .set-field-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .set-input { flex: 1; min-width: 180px; background: #1a1a24; border: 1px solid #2d2d3a; color: var(--text); padding: 9px 12px; font-family: var(--font-body); font-size: 14px; }
        .set-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 0; border-color: var(--accent); }

        .set-account-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .set-vrule { width: 1px; height: 18px; background: var(--border-strong); flex-shrink: 0; }

        /* Themes — compact 3×2 */
        .set-themes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .set-theme-card { min-height: 80px; text-align: left; cursor: pointer; padding: 12px 14px; border: 1px solid var(--border); background: var(--bg-card); display: flex; flex-direction: column; justify-content: space-between; gap: 10px; transition: border-color var(--t-fast) var(--ease-out), box-shadow var(--t-base) var(--ease-out), background var(--t-fast); }
        .set-theme-card:hover { background: #252535; border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent-light), var(--shadow-accent); }
        .set-theme-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .set-theme-card.on { border-width: 2px; background: #252535; }
        .set-theme-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
        .set-theme-name { font-family: var(--font-body); font-size: 14px; font-weight: 700; color: var(--ink); }
        .set-theme-badge { font-family: var(--font-mono); font-size: 8.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent-text); display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0; }
        .set-theme-pastilles { display: flex; gap: 6px; }
        .set-theme-pastilles span { flex: 1; height: 16px; border: 1px solid rgba(0,0,0,0.25); }

        /* Language toggle */
        .set-lang { display: inline-flex; gap: 8px; }
        .set-lang-btn { padding: 9px 22px; font-family: var(--font-body); font-size: 14px; font-weight: 600; cursor: pointer; background: var(--bg-card); color: var(--text-muted); border: 1px solid #2d2d3a; transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast); }
        .set-lang-btn:hover { border-color: var(--accent); color: var(--accent-text); }
        .set-lang-btn.on { background: var(--accent); color: #12131a; font-weight: 700; border-color: var(--accent); cursor: default; }
        .set-lang-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

        /* Data */
        .set-data-info { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); }
        .set-data-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .set-danger-ghost { color: var(--danger); }
        .set-danger-ghost:hover { background: color-mix(in srgb, var(--danger) 12%, transparent); border-color: var(--danger); }

        /* Danger zone */
        .set-danger-card { background: #1a0a0a; border: 1px solid #3a1a1a; padding: 18px; display: flex; flex-direction: column; gap: 14px; align-items: flex-start; }
        .set-danger-text { margin: 0; font-size: 13px; color: var(--text-muted); }
        .set-danger-btn { background: transparent; color: var(--danger); border: 1px solid var(--danger); }
        .set-danger-btn:hover { background: color-mix(in srgb, var(--danger) 14%, transparent); }

        /* About */
        .set-about { gap: 8px; }
        .set-about-version { font-family: var(--font-mono); font-size: 13px; color: var(--ink); font-weight: 700; }
        .set-about-tagline { margin: 0; font-size: 14px; color: var(--text-muted); font-style: italic; }
        .set-about-links { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-family: var(--font-mono); font-size: 11px; color: var(--text-light); margin-top: 4px; }
        .set-about-links a { color: var(--text-muted); text-decoration: none; transition: color var(--t-fast); }
        .set-about-links a:hover { color: var(--accent-text); }

        @media (max-width: 560px) {
          .set-themes { grid-template-columns: repeat(2, 1fr); }
          .set-lang { display: flex; }
          .set-lang-btn { flex: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .set-theme-card { transition: border-color var(--t-fast) ease; }
          .set-theme-card:hover { box-shadow: none; }
        }
      `}</style>
    </div>
  );
}
