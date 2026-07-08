'use client';
import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useFamilyStore } from '@/hooks/useFamilyStore';
import { BrandLockup } from '@/components/Brand';
import { ArrowLeft, ArrowRight, Save, KeyRound, LogOut, TreePine, Trash2 } from 'lucide-react';

function initials(name?: string | null, email?: string | null): string {
  const src = (name || email || '?').trim();
  const parts = src.split(/[\s.@_-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase().slice(0, 2);
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '—';
  }
}

function fmtMonthYear(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function ProfilPage() {
  const t = useTranslations('profile');
  const { user, signOut, role } = useAuth();
  const roleLabel = role === 'superadmin' ? t('roleSuperadmin') : role === 'admin' ? t('roleAdmin') : t('roleMember');
  const storeUser = useMemo(() => (user ? { id: user.id, email: user.email } : null), [user?.id, user?.email]);
  const store = useFamilyStore(storeUser);

  const displayName = (user?.user_metadata?.display_name as string | undefined) || '';
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const email = user?.email || '';

  const [name, setName] = useState(displayName);
  const [savingName, setSavingName] = useState(false);
  const [nameNote, setNameNote] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [pwdNote, setPwdNote] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [confirmDeleteTree, setConfirmDeleteTree] = useState<string | null>(null);

  if (!supabase || !user) return null;

  const totalPersons = store.trees.reduce((sum, t) => sum + (t.persons?.length || 0), 0);

  async function saveName() {
    if (!supabase) return;
    setSavingName(true);
    setNameNote(null);
    const { error } = await supabase.auth.updateUser({ data: { display_name: name.trim() } });
    setSavingName(false);
    setNameNote(error
      ? { msg: t('toastNameFailed'), type: 'error' }
      : { msg: t('toastNameUpdated'), type: 'success' });
  }

  async function changePassword() {
    if (!supabase || !email) return;
    setPwdNote(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });
    setPwdNote(error
      ? { msg: t('toastEmailFailed'), type: 'error' }
      : { msg: t('toastEmailSent'), type: 'success' });
  }

  async function handleSignOut() {
    await signOut();
    window.location.href = '/';
  }

  function openTree(treeId: string) {
    localStorage.setItem('suimini_active_tree', treeId);
    window.location.href = '/app';
  }

  const noteStyle = (type: 'success' | 'error'): React.CSSProperties => ({
    fontSize: '12px',
    fontWeight: 600,
    color: type === 'error' ? 'var(--danger)' : 'var(--success)',
    marginTop: '8px',
  });

  return (
    <div style={{ minHeight: '100vh', overflowY: 'auto', background: 'var(--bg)' }}>
      {/* Top bar */}
      <header
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          flexWrap: 'wrap', padding: '16px 24px', borderBottom: 'var(--bw) solid var(--border-strong)',
          background: 'var(--bg-card)',
        }}
      >
        <BrandLockup size={28} color="var(--ink)" accent="var(--accent)" surface="var(--bg-card)" />
        <button
          className="btn btn-ghost btn-sm"
          style={{ gap: '6px' }}
          onClick={() => { window.location.href = '/app'; }}
        >
          <ArrowLeft size={16} aria-hidden="true" /> {t('backToApp')}
        </button>
      </header>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 24px 64px' }} className="animate-fade-in">
        <h1 className="serif" style={{ margin: '0 0 24px', fontSize: '2rem', letterSpacing: '-0.02em' }}>{t('title')}</h1>

        {/* 1) HEADER card */}
        <section className="card" style={{ padding: '24px', marginBottom: '20px' }}>
          <div className="label" style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>{t('identity')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius)', border: 'var(--bw) solid var(--border-strong)', flexShrink: 0 }}
              />
            ) : (
              <div
                aria-hidden="true"
                style={{
                  width: '80px', height: '80px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--accent)', color: '#0d0d0d',
                  fontWeight: 700, fontSize: '28px',
                  borderRadius: 'var(--radius)', border: 'var(--bw) solid var(--border-strong)',
                }}
                className="serif"
              >
                {initials(displayName, email)}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 className="serif" style={{ margin: '0 0 2px', fontSize: '1.5rem', wordBreak: 'break-word' }}>
                {displayName || email.split('@')[0]}
              </h2>
              <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '10px', wordBreak: 'break-word' }}>{email}</div>
              <span className="badge badge-accent">{roleLabel}</span>
            </div>
          </div>
        </section>

        {/* 2) MES ARBRES */}
        <section className="card" style={{ padding: '24px', marginBottom: '20px' }}>
          <div className="label" style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>{t('myTrees')}</div>
          {!store.loaded ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '14px' }}>
              <span className="spinner" style={{ color: 'var(--accent)' }} /> {t('loading')}
            </div>
          ) : store.trees.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{t('noTrees')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {store.trees.map(tree => (
                <div
                  key={tree.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                    flexWrap: 'wrap',
                    border: 'var(--bw) solid var(--border-strong)', borderRadius: 'var(--radius)',
                    padding: '14px 16px', background: 'var(--bg-card)',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <TreePine size={18} aria-hidden="true" style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', wordBreak: 'break-word' }}>{tree.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {t('treeMeta', { persons: tree.persons?.length || 0, links: tree.relationships?.length || 0, date: fmtDate(tree.createdAt) })}
                      </div>
                    </div>
                  </div>
                  {confirmDeleteTree === tree.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0, maxWidth: '240px' }}>
                      <span role="alert" style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 600, textAlign: 'right', lineHeight: 1.35 }}>
                        {t('deleteTreeConfirm', { name: tree.name })}
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-danger btn-sm" style={{ gap: '6px' }}
                          onClick={() => { store.deleteTree(tree.id); setConfirmDeleteTree(null); }}
                        ><Trash2 size={13} aria-hidden="true" /> {t('deleteTreeConfirmBtn')}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteTree(null)}>{t('deleteTreeCancel')}</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button className="btn btn-secondary btn-sm" style={{ gap: '6px' }} onClick={() => openTree(tree.id)}>
                        {t('open')} <ArrowRight size={14} aria-hidden="true" />
                      </button>
                      {store.trees.length > 1 && (
                        <button
                          className="btn btn-ghost btn-sm btn-icon" aria-label={t('deleteTree')} title={t('deleteTree')}
                          style={{ color: 'var(--danger)' }}
                          onClick={() => setConfirmDeleteTree(tree.id)}
                        ><Trash2 size={14} aria-hidden="true" /></button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3) STATISTIQUES */}
        <section className="card" style={{ padding: '24px', marginBottom: '20px' }}>
          <div className="label" style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>{t('statistics')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            {[
              { value: String(totalPersons), label: t('statPersons') },
              { value: String(store.trees.length), label: t('statTrees') },
              { value: fmtMonthYear(user.created_at), label: t('statMemberSince') },
            ].map(stat => (
              <div
                key={stat.label}
                style={{
                  border: 'var(--bw) solid var(--border-strong)', borderRadius: 'var(--radius)',
                  padding: '16px', background: 'var(--bg-card)',
                }}
              >
                <div className="serif" style={{ fontSize: '1.9rem', lineHeight: 1.05, color: 'var(--accent)', wordBreak: 'break-word' }}>
                  {stat.value}
                </div>
                <div className="label" style={{ color: 'var(--text-muted)', marginTop: '6px' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 4) COMPTE */}
        <section className="card" style={{ padding: '24px' }}>
          <div className="label" style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>{t('account')}</div>

          {/* Display name */}
          <div style={{ marginBottom: '24px' }}>
            <label className="label" htmlFor="profil-display-name" style={{ display: 'block', marginBottom: '8px' }}>{t('displayName')}</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                id="profil-display-name"
                className="input"
                style={{ flex: 1, minWidth: '200px' }}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('displayNamePlaceholder')}
              />
              <button
                className="btn btn-secondary btn-sm"
                style={{ gap: '6px' }}
                onClick={saveName}
                disabled={savingName || name.trim() === displayName.trim() || name.trim() === ''}
              >
                <Save size={14} aria-hidden="true" /> {savingName ? t('saving') : t('save')}
              </button>
            </div>
            {nameNote && <div role={nameNote.type === 'error' ? 'alert' : 'status'} style={noteStyle(nameNote.type)}>{nameNote.msg}</div>}
          </div>

          {/* Change password */}
          <div style={{ marginBottom: '24px' }}>
            <label className="label" style={{ display: 'block', marginBottom: '8px' }}>{t('password')}</label>
            <button className="btn btn-secondary btn-sm" style={{ gap: '6px' }} onClick={changePassword}>
              <KeyRound size={14} aria-hidden="true" /> {t('changePassword')}
            </button>
            {pwdNote && <div role={pwdNote.type === 'error' ? 'alert' : 'status'} style={noteStyle(pwdNote.type)}>{pwdNote.msg}</div>}
          </div>

          {/* Sign out */}
          <div>
            <label className="label" style={{ display: 'block', marginBottom: '8px' }}>{t('session')}</label>
            <button className="btn btn-danger btn-sm" style={{ gap: '6px' }} onClick={handleSignOut}>
              <LogOut size={14} aria-hidden="true" /> {t('signOut')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
