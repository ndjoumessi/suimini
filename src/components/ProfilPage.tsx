'use client';
import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useFamilyStore } from '@/hooks/useFamilyStore';
import { BrandLockup } from '@/components/Brand';
import { ArrowLeft, ArrowRight, Save, KeyRound, LogOut, TreePine } from 'lucide-react';

function initials(name?: string | null, email?: string | null): string {
  const src = (name || email || '?').trim();
  const parts = src.split(/[\s.@_-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase().slice(0, 2);
}

function roleLabel(role?: string): string {
  if (role === 'superadmin') return 'Super-admin';
  if (role === 'admin') return 'Admin';
  return 'Membre';
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
  const { user, signOut, role } = useAuth();
  const storeUser = useMemo(() => (user ? { id: user.id, email: user.email } : null), [user?.id, user?.email]);
  const store = useFamilyStore(storeUser);

  const displayName = (user?.user_metadata?.display_name as string | undefined) || '';
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const email = user?.email || '';

  const [name, setName] = useState(displayName);
  const [savingName, setSavingName] = useState(false);
  const [nameNote, setNameNote] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [pwdNote, setPwdNote] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  if (!supabase || !user) return null;

  const totalPersons = store.trees.reduce((sum, t) => sum + (t.persons?.length || 0), 0);

  async function saveName() {
    if (!supabase) return;
    setSavingName(true);
    setNameNote(null);
    const { error } = await supabase.auth.updateUser({ data: { display_name: name.trim() } });
    setSavingName(false);
    setNameNote(error
      ? { msg: 'Échec de la mise à jour du nom.', type: 'error' }
      : { msg: 'Nom mis à jour.', type: 'success' });
  }

  async function changePassword() {
    if (!supabase || !email) return;
    setPwdNote(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });
    setPwdNote(error
      ? { msg: "Échec de l'envoi de l'email.", type: 'error' }
      : { msg: 'Email envoyé.', type: 'success' });
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
          <ArrowLeft size={16} aria-hidden="true" /> Retour à l&apos;app
        </button>
      </header>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 24px 64px' }} className="animate-fade-in">
        <h1 className="serif" style={{ margin: '0 0 24px', fontSize: '2rem', letterSpacing: '-0.02em' }}>Profil</h1>

        {/* 1) HEADER card */}
        <section className="card" style={{ padding: '24px', marginBottom: '20px' }}>
          <div className="label" style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Identité</div>
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
                  background: 'var(--accent)', color: '#fff',
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
              <span className="badge badge-accent">{roleLabel(role)}</span>
            </div>
          </div>
        </section>

        {/* 2) MES ARBRES */}
        <section className="card" style={{ padding: '24px', marginBottom: '20px' }}>
          <div className="label" style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Mes arbres</div>
          {!store.loaded ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '14px' }}>
              <span className="spinner" style={{ color: 'var(--accent)' }} /> Chargement…
            </div>
          ) : store.trees.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Aucun arbre pour le moment.</div>
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
                        {tree.persons?.length || 0} personnes · {tree.relationships?.length || 0} liens · créé le {fmtDate(tree.createdAt)}
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-secondary btn-sm" style={{ gap: '6px' }} onClick={() => openTree(tree.id)}>
                    Ouvrir <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3) STATISTIQUES */}
        <section className="card" style={{ padding: '24px', marginBottom: '20px' }}>
          <div className="label" style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Statistiques</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            {[
              { value: String(totalPersons), label: 'Total personnes' },
              { value: String(store.trees.length), label: 'Total arbres' },
              { value: fmtMonthYear(user.created_at), label: 'Membre depuis' },
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
          <div className="label" style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Compte</div>

          {/* Display name */}
          <div style={{ marginBottom: '24px' }}>
            <label className="label" htmlFor="profil-display-name" style={{ display: 'block', marginBottom: '8px' }}>Nom affiché</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                id="profil-display-name"
                className="input"
                style={{ flex: 1, minWidth: '200px' }}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Votre nom"
              />
              <button
                className="btn btn-secondary btn-sm"
                style={{ gap: '6px' }}
                onClick={saveName}
                disabled={savingName || name.trim() === displayName.trim() || name.trim() === ''}
              >
                <Save size={14} aria-hidden="true" /> {savingName ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
            {nameNote && <div style={noteStyle(nameNote.type)}>{nameNote.msg}</div>}
          </div>

          {/* Change password */}
          <div style={{ marginBottom: '24px' }}>
            <label className="label" style={{ display: 'block', marginBottom: '8px' }}>Mot de passe</label>
            <button className="btn btn-secondary btn-sm" style={{ gap: '6px' }} onClick={changePassword}>
              <KeyRound size={14} aria-hidden="true" /> Changer le mot de passe
            </button>
            {pwdNote && <div style={noteStyle(pwdNote.type)}>{pwdNote.msg}</div>}
          </div>

          {/* Sign out */}
          <div>
            <label className="label" style={{ display: 'block', marginBottom: '8px' }}>Session</label>
            <button className="btn btn-danger btn-sm" style={{ gap: '6px' }} onClick={handleSignOut}>
              <LogOut size={14} aria-hidden="true" /> Se déconnecter
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
