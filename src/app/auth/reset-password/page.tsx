'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, Check, X, ArrowRight, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { passwordChecks, passwordScore, strengthLevel } from '@/lib/password';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabase) { setReady('invalid'); return; }
    const sb = supabase;
    sb.auth.getSession().then(({ data }) => setReady(data.session ? 'ok' : 'invalid'));
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => { if (session) setReady('ok'); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const checks = passwordChecks(password);
  const score = passwordScore(password);
  const level = strengthLevel(score);
  const colors = ['var(--danger)', 'var(--warning)', 'var(--success)'];
  const labels = ['Faible', 'Moyen', 'Fort'];
  const confirmValid = confirm.length > 0 && confirm === password;
  const canSubmit = password.length >= 8 && confirmValid;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!supabase) return;
    if (password.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return; }
    if (!confirmValid) { setError('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    try { sessionStorage.setItem('suimini_pending_toast', '✅ Mot de passe mis à jour, vous êtes connecté'); } catch { /* ignore */ }
    setTimeout(() => router.push('/app'), 1400);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'var(--bg)' }}>
      <div className="card animate-scale-in" style={{ width: '100%', maxWidth: '420px', padding: '28px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div className="serif" style={{ fontSize: '1.7rem', color: 'var(--accent)' }}>🌿 Suimini</div>
          <h1 className="serif" style={{ fontSize: '1.3rem', margin: '8px 0 0' }}>Nouveau mot de passe</h1>
        </div>

        {ready === 'checking' && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}><span className="spinner" /> Vérification du lien…</p>}

        {ready === 'invalid' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--danger)', display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}><AlertCircle size={16} /> Lien invalide ou expiré.</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Demandez un nouveau lien de réinitialisation.</p>
            <button onClick={() => router.push('/')} className="btn btn-secondary" style={{ marginTop: '10px' }}>Retour à l’accueil</button>
          </div>
        )}

        {ready === 'ok' && (done ? (
          <div style={{ textAlign: 'center' }} className="animate-fade-in">
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>✅</div>
            <p>Mot de passe mis à jour. Redirection…</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '5px' }}>Nouveau mot de passe</label>
            <div style={{ position: 'relative', marginBottom: '4px' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-light)' }} />
              <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoFocus aria-label="Nouveau mot de passe"
                placeholder="Min. 8 caractères" className="input" style={{ paddingLeft: '38px', paddingRight: '40px', minHeight: '44px' }} />
              <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Masquer' : 'Afficher'} className="icon-btn" style={{ position: 'absolute', right: '4px', top: '4px' }}>
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {password.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                  {[0, 1, 2].map(i => <div key={i} style={{ flex: 1, height: '4px', borderRadius: '99px', background: i <= level ? colors[level] : 'var(--bg-muted)' }} />)}
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
                  <span style={{ color: colors[level], fontWeight: 700 }}>{labels[level]}</span>
                  <Crit ok={checks.length} label="8 caractères" />
                  <Crit ok={checks.upper} label="Majuscule" />
                  <Crit ok={checks.digit} label="Chiffre" />
                </div>
              </div>
            )}
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '5px' }}>Confirmer</label>
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-light)' }} />
              <input type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} aria-label="Confirmer le mot de passe"
                placeholder="••••••••" className="input" style={{ paddingLeft: '38px', paddingRight: '38px', minHeight: '44px', borderColor: confirm.length > 0 ? (confirmValid ? 'var(--success)' : 'var(--danger)') : 'var(--border)' }} />
              {confirm.length > 0 && <span style={{ position: 'absolute', right: '12px', top: '14px', color: confirmValid ? 'var(--success)' : 'var(--danger)' }}>{confirmValid ? <Check size={16} /> : <X size={16} />}</span>}
            </div>
            {error && <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}><AlertCircle size={15} /> {error}</div>}
            <button type="submit" disabled={!canSubmit || loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', minHeight: '44px' }}>
              {loading ? <><span className="spinner" /> Mise à jour…</> : <>Mettre à jour le mot de passe <ArrowRight size={16} /></>}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}

function Crit({ ok, label }: { ok: boolean; label: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: ok ? 'var(--success)' : 'var(--text-light)' }}>{ok ? <Check size={12} /> : <X size={12} />} {label}</span>;
}
