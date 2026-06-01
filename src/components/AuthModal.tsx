'use client';
import { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Gamepad2, Check, X as XIcon, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOverlay } from '@/hooks/useOverlay';
import { passwordChecks, passwordScore, strengthLevel, PasswordChecks } from '@/lib/password';

type Tab = 'signin' | 'signup' | 'magic';
interface Props {
  onClose: () => void;
  initialTab?: Tab;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const inputBase: React.CSSProperties = {
  width: '100%', minHeight: '44px', padding: '10px 12px 10px 38px',
  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  background: 'var(--bg-card)', color: 'var(--text)', fontSize: '14px',
  fontFamily: 'Lato, sans-serif', outline: 'none', transition: 'border-color var(--t-fast), box-shadow var(--t-fast)',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '5px',
};

export default function AuthModal({ onClose, initialTab = 'signin' }: Props) {
  const { configured, signUp, signIn, signInWithMagicLink, resetPassword, startDemo } = useAuth();
  const overlayRef = useOverlay<HTMLDivElement>(onClose);

  const [tab, setTab] = useState<Tab>(initialTab);
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentMsg, setSentMsg] = useState('');

  const emailValid = EMAIL_RE.test(email.trim());
  const pwChecks = passwordChecks(password);
  const pwScore = passwordScore(password);
  const pwValid = password.length >= 8;
  const confirmValid = confirm.length > 0 && confirm === password;

  const reset = () => { setError(''); };

  function switchTab(t: Tab) {
    setTab(t); setForgot(false); setError(''); setSentMsg('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (forgot) {
      if (!emailValid) { setError('Adresse e-mail invalide.'); return; }
      setLoading(true);
      const { error } = await resetPassword(email);
      setLoading(false);
      if (error) setError(error);
      else setSentMsg('📧 Lien de réinitialisation envoyé. Consultez votre boîte mail.');
      return;
    }
    if (tab === 'magic') {
      if (!emailValid) { setError('Adresse e-mail invalide.'); return; }
      setLoading(true);
      const { error } = await signInWithMagicLink(email);
      setLoading(false);
      if (error) setError(error);
      else setSentMsg('📧 Lien envoyé ! Vérifiez votre boîte mail et cliquez le lien pour vous connecter.');
      return;
    }
    if (tab === 'signin') {
      if (!emailValid || !password) { setError('Veuillez renseigner email et mot de passe.'); return; }
      setLoading(true);
      const { error } = await signIn(email, password);
      setLoading(false);
      if (error) setError(error);
      else onClose(); // success → app reacts via onAuthStateChange
      return;
    }
    // signup
    if (!displayName.trim()) { setError('Veuillez indiquer un nom d’affichage.'); return; }
    if (!emailValid) { setError('Adresse e-mail invalide.'); return; }
    if (!pwValid) { setError('Le mot de passe doit faire au moins 8 caractères.'); return; }
    if (!confirmValid) { setError('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    const { error } = await signUp(email, password, displayName);
    setLoading(false);
    if (error) setError(error);
    else setSentMsg('✉️ Vérifiez votre boîte mail pour confirmer votre compte.');
  }

  const canSubmit = forgot ? emailValid
    : tab === 'magic' ? emailValid
      : tab === 'signin' ? (emailValid && password.length > 0)
        : (displayName.trim().length > 0 && emailValid && pwValid && confirmValid);

  const submitLabel = forgot ? 'Envoyer le lien'
    : tab === 'magic' ? 'Recevoir le lien'
      : tab === 'signin' ? 'Se connecter'
        : 'Créer mon compte';

  return (
    <div
      onMouseDown={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(26,22,18,0.55)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '8vh', overflowY: 'auto' }}
    >
      <div ref={overlayRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Authentification" className="animate-scale-in"
        style={{ width: '92%', maxWidth: '440px', background: 'var(--bg-card)', borderRadius: '16px', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '40px' }}
      >
        {/* Header */}
        <div style={{ padding: '24px 24px 16px', textAlign: 'center', position: 'relative' }}>
          <button onClick={onClose} aria-label="Fermer" className="icon-btn" style={{ position: 'absolute', top: '12px', right: '12px' }}><XIcon size={18} /></button>
          <div className="serif" style={{ fontSize: '1.7rem', color: 'var(--accent)' }}>🌿 Suimini</div>
          <p className="serif" style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Votre histoire familiale vous attend
          </p>
        </div>

        {sentMsg ? (
          <div style={{ padding: '8px 28px 32px', textAlign: 'center' }} className="animate-fade-in">
            <div style={{ fontSize: '44px', marginBottom: '10px' }}>{sentMsg.slice(0, 2)}</div>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text)', margin: '0 0 16px' }}>{sentMsg.slice(2).trim()}</p>
            <button onClick={onClose} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Fermer</button>
          </div>
        ) : forgot ? (
          <form onSubmit={handleSubmit} style={{ padding: '4px 24px 24px' }}>
            <button type="button" onClick={() => { setForgot(false); setError(''); }} className="btn btn-ghost btn-sm" style={{ marginBottom: '8px' }}><ArrowLeft size={14} /> Retour</button>
            <h3 className="serif" style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>Mot de passe oublié</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px' }}>Saisissez votre email pour recevoir un lien de réinitialisation.</p>
            <EmailField email={email} setEmail={setEmail} emailValid={emailValid} />
            {error && <InlineError msg={error} />}
            <SubmitBtn loading={loading} disabled={!canSubmit} label="Envoyer le lien" />
          </form>
        ) : (
          <>
            {/* Tabs */}
            <div role="tablist" style={{ display: 'flex', margin: '0 24px', borderBottom: '2px solid var(--border)' }}>
              {([['signin', 'Connexion'], ['signup', 'Inscription'], ['magic', 'Magic Link']] as [Tab, string][]).map(([t, lbl]) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => switchTab(t)}
                  style={{ flex: 1, minHeight: '44px', padding: '10px 6px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'Lato, sans-serif', fontSize: '13px', fontWeight: tab === t ? 700 : 400, color: tab === t ? 'var(--accent)' : 'var(--text-muted)', borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`, marginBottom: '-2px', transition: 'color var(--t-fast)' }}>
                  {lbl}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '18px 24px 8px' }}>
              {tab === 'signup' && (
                <IconField label="Nom d’affichage" Icon={User} autoFocus value={displayName} onChange={setDisplayName} placeholder="Marie Dupont" autoComplete="name" valid={displayName.trim().length > 0} ariaLabel="Nom d’affichage" />
              )}

              <EmailField email={email} setEmail={setEmail} emailValid={emailValid} autoFocus={tab !== 'signup'} />

              {tab !== 'magic' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle} htmlFor="pw">Mot de passe</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: '12px', top: '22px', color: 'var(--text-light)' }} />
                    <input id="pw" type={showPw ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); reset(); }}
                      placeholder={tab === 'signup' ? 'Min. 8 caractères' : '••••••••'} autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                      aria-label="Mot de passe" style={{ ...inputBase, paddingRight: '40px' }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-light)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }} />
                    <button type="button" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} className="icon-btn" style={{ position: 'absolute', right: '4px', top: '12px', width: '32px', height: '32px' }}>
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {tab === 'signup' && password.length > 0 && <PasswordStrength score={pwScore} checks={pwChecks} />}

                  {tab === 'signin' && (
                    <div style={{ textAlign: 'right', marginTop: '6px' }}>
                      <button type="button" onClick={() => { setForgot(true); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', padding: '4px' }}>Mot de passe oublié ?</button>
                    </div>
                  )}
                </div>
              )}

              {tab === 'signup' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle} htmlFor="cpw">Confirmer le mot de passe</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: '12px', top: '22px', color: 'var(--text-light)' }} />
                    <input id="cpw" type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => { setConfirm(e.target.value); reset(); }}
                      placeholder="••••••••" autoComplete="new-password" aria-label="Confirmer le mot de passe"
                      aria-invalid={confirm.length > 0 && !confirmValid}
                      style={{ ...inputBase, paddingRight: '64px', borderColor: confirm.length > 0 ? (confirmValid ? 'var(--success)' : 'var(--danger)') : 'var(--border)' }} />
                    {confirm.length > 0 && (
                      <span style={{ position: 'absolute', right: '40px', top: '14px', color: confirmValid ? 'var(--success)' : 'var(--danger)' }}>
                        {confirmValid ? <Check size={16} /> : <XIcon size={16} />}
                      </span>
                    )}
                    <button type="button" onClick={() => setShowConfirm(s => !s)} aria-label={showConfirm ? 'Masquer' : 'Afficher'} className="icon-btn" style={{ position: 'absolute', right: '4px', top: '12px', width: '32px', height: '32px' }}>
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}

              {tab === 'signin' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                  Rester connecté
                </label>
              )}

              {tab === 'magic' && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
                  Connexion sans mot de passe : vous recevrez un lien magique par e-mail.
                </p>
              )}

              {error && <InlineError msg={error} />}

              <SubmitBtn loading={loading} disabled={!canSubmit} label={submitLabel} />
            </form>

            {!configured && (
              <p style={{ fontSize: '11px', color: 'var(--warning)', textAlign: 'center', margin: '0 24px 8px' }}>
                ⚠️ Supabase non configuré — seul le mode démo est disponible.
              </p>
            )}

            {/* Demo */}
            <div style={{ padding: '4px 24px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0 14px' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>ou</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>
              <button type="button" onClick={startDemo} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                <Gamepad2 size={16} /> Essayer le compte démo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- sub-components ---------- */

function EmailField({ email, setEmail, emailValid, autoFocus }: { email: string; setEmail: (v: string) => void; emailValid: boolean; autoFocus?: boolean }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={labelStyle} htmlFor="email">Email</label>
      <div style={{ position: 'relative' }}>
        <Mail size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-light)' }} />
        <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.com" autoComplete="email"
          autoFocus={autoFocus} aria-label="Email" aria-invalid={email.length > 0 && !emailValid}
          style={{ ...inputBase, paddingRight: '36px', borderColor: email.length > 0 ? (emailValid ? 'var(--success)' : 'var(--danger)') : 'var(--border)' }} />
        {email.length > 0 && (
          <span style={{ position: 'absolute', right: '12px', top: '14px', color: emailValid ? 'var(--success)' : 'var(--danger)' }}>
            {emailValid ? <Check size={16} /> : <XIcon size={16} />}
          </span>
        )}
      </div>
    </div>
  );
}

function IconField({ label, Icon, value, onChange, placeholder, autoComplete, valid, autoFocus, ariaLabel }: {
  label: string; Icon: typeof User; value: string; onChange: (v: string) => void; placeholder: string; autoComplete?: string; valid?: boolean; autoFocus?: boolean; ariaLabel: string;
}) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <Icon size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-light)' }} />
        <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete}
          autoFocus={autoFocus} aria-label={ariaLabel} style={{ ...inputBase, paddingRight: '36px' }} />
        {value.length > 0 && valid && <span style={{ position: 'absolute', right: '12px', top: '14px', color: 'var(--success)' }}><Check size={16} /></span>}
      </div>
    </div>
  );
}

function PasswordStrength({ score, checks }: { score: number; checks: PasswordChecks }) {
  const level = strengthLevel(score);
  const colors = ['var(--danger)', 'var(--warning)', 'var(--success)'];
  const labels = ['Faible', 'Moyen', 'Fort'];
  return (
    <div style={{ marginTop: '8px' }} aria-live="polite">
      <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ flex: 1, height: '4px', borderRadius: '99px', background: i <= level ? colors[level] : 'var(--bg-muted)', transition: 'background var(--t-base)' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '11px', color: colors[level], fontWeight: 700 }}>{labels[level]}</span>
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '11px' }}>
        <Crit ok={checks.length} label="8 caractères" />
        <Crit ok={checks.upper} label="Majuscule" />
        <Crit ok={checks.digit} label="Chiffre" />
      </div>
    </div>
  );
}
function Crit({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: ok ? 'var(--success)' : 'var(--text-light)' }}>
      {ok ? <Check size={12} /> : <XIcon size={12} />} {label}
    </span>
  );
}

function InlineError({ msg }: { msg: string }) {
  return (
    <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger)', fontSize: '13px', marginBottom: '12px', background: 'rgba(156,59,59,0.08)', padding: '8px 10px', borderRadius: 'var(--radius)' }}>
      <AlertCircle size={15} style={{ flexShrink: 0 }} /> {msg}
    </div>
  );
}

function SubmitBtn({ loading, disabled, label }: { loading: boolean; disabled: boolean; label: string }) {
  return (
    <button type="submit" disabled={disabled || loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', minHeight: '44px' }}>
      {loading ? <><span className="spinner" /> {label === 'Se connecter' ? 'Connexion en cours…' : 'Veuillez patienter…'}</> : <>{label} <ArrowRight size={16} /></>}
    </button>
  );
}
