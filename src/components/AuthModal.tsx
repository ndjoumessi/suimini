'use client';
import { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Gamepad2, Check, X as XIcon, AlertCircle, ArrowLeft, Building2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOverlay } from '@/hooks/useOverlay';
import { passwordChecks, strengthInfo } from '@/lib/password';
import { BrandLockup } from './Brand';

type Tab = 'login' | 'signup';
interface Props {
  onClose: () => void;
  initialTab?: Tab;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ACCENT = 'var(--accent)';

export default function AuthModal({ onClose, initialTab = 'login' }: Props) {
  const { signUp, signIn, resetPassword, startDemo } = useAuth();
  const overlayRef = useOverlay<HTMLDivElement>(onClose);

  const [tab, setTab] = useState<Tab>(initialTab);
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [organization, setOrganization] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentMsg, setSentMsg] = useState('');

  const emailValid = EMAIL_RE.test(email.trim());
  const pwChecks = passwordChecks(password);
  const strength = strengthInfo(password);
  const pwValid = password.length >= 8;
  const confirmValid = confirm.length > 0 && confirm === password;

  function switchTab(t: Tab) { setTab(t); setForgot(false); setError(''); setSentMsg(''); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (forgot) {
      if (!emailValid) { setError('Adresse e-mail invalide.'); return; }
      setLoading(true);
      const { error } = await resetPassword(email);
      setLoading(false);
      if (error) setError(error);
      else setSentMsg('Lien de réinitialisation envoyé. Consultez votre boîte mail.');
      return;
    }
    if (tab === 'login') {
      if (!emailValid || !password) { setError('Veuillez renseigner email et mot de passe.'); return; }
      setLoading(true);
      const { error } = await signIn(email, password);
      if (error) { setLoading(false); setError(error); return; }
      // Explicit login → go to the app. Full navigation so the proxy/HomeGate gate
      // the destination by status (approved → /app ; pending/rejected/suspended →
      // bounced back to / where the matching status screen is shown).
      onClose();
      window.location.href = '/app';
      return;
    }
    // signup
    if (!displayName.trim()) { setError('Veuillez indiquer un nom d’affichage.'); return; }
    if (!emailValid) { setError('Adresse e-mail invalide.'); return; }
    if (!pwValid) { setError('Le mot de passe doit faire au moins 8 caractères.'); return; }
    if (!confirmValid) { setError('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    const { error } = await signUp(email, password, displayName, organization);
    setLoading(false);
    if (error) setError(error);
    else setSentMsg('Demande envoyée ! Un administrateur va examiner votre inscription.');
  }

  const canSubmit = forgot ? emailValid
    : tab === 'login' ? (emailValid && password.length > 0)
      : (displayName.trim().length > 0 && emailValid && pwValid && confirmValid);

  const submitLabel = forgot ? 'Envoyer le lien' : tab === 'login' ? 'Se connecter' : 'Créer mon compte';

  return (
    <div className="auth-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div ref={overlayRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Authentification" className="auth-modal animate-scale-in">
        <button onClick={onClose} aria-label="Fermer" className="auth-x"><XIcon size={18} /></button>

        {/* Logo + tagline */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <BrandLockup size={30} color="var(--ink)" accent="var(--accent)" surface="var(--bg-card)" fontSize={24} />
          </div>
          <p className="label" style={{ margin: 0, color: 'var(--text-muted)' }}>
            Votre histoire familiale vous attend
          </p>
        </div>

        {sentMsg ? (
          <div className="animate-fade-in" style={{ textAlign: 'center' }}>
            <CheckCircle2 size={44} style={{ color: 'var(--success)', marginBottom: '10px' }} aria-hidden="true" />
            <p style={{ fontSize: '14px', lineHeight: 1.6, margin: '0 0 16px' }}>{sentMsg}</p>
            <button onClick={onClose} className="auth-submit">Fermer</button>
          </div>
        ) : forgot ? (
          <form onSubmit={handleSubmit}>
            <button type="button" onClick={() => { setForgot(false); setError(''); }} className="btn btn-ghost btn-sm" style={{ marginBottom: '8px' }}><ArrowLeft size={14} /> Retour</button>
            <h3 className="serif" style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>Mot de passe oublié</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px' }}>Saisissez votre email pour recevoir un lien de réinitialisation.</p>
            <Field label="Email" Icon={Mail} type="email" value={email} onChange={setEmail} placeholder="vous@exemple.com" autoComplete="email" autoFocus valid={email.length > 0 ? emailValid : undefined} ariaLabel="Email" />
            {error && <ErrorMsg msg={error} />}
            <SubmitBtn loading={loading} disabled={!canSubmit} label="Envoyer le lien" style={{ marginTop: '16px' }} />
          </form>
        ) : (
          <>
            {/* Tabs (2, 50/50, animated underline) */}
            <div role="tablist" className="auth-tabs">
              {([['login', 'Connexion'], ['signup', 'Inscription']] as [Tab, string][]).map(([t, lbl]) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => switchTab(t)}
                  className="auth-tab" style={{ color: tab === t ? ACCENT : 'var(--text-muted)', fontWeight: tab === t ? 700 : 400 }}>
                  {lbl}
                </button>
              ))}
              <span className="auth-tab-underline" style={{ transform: tab === 'login' ? 'translateX(0)' : 'translateX(100%)' }} />
            </div>

            <form onSubmit={handleSubmit}>
              {tab === 'signup' && (
                <Field label="Nom d’affichage" Icon={User} value={displayName} onChange={setDisplayName} placeholder="Marie Dupont" autoComplete="name" autoFocus valid={displayName.trim().length > 0 ? true : undefined} ariaLabel="Nom d’affichage" />
              )}

              {tab === 'signup' && (
                <Field label="Organisation / Famille (optionnel)" Icon={Building2} value={organization} onChange={setOrganization} placeholder="Ex: Famille Dupont, Association..." autoComplete="organization" ariaLabel="Organisation ou famille" />
              )}

              <Field label="Email" Icon={Mail} type="email" value={email} onChange={setEmail} placeholder="vous@exemple.com" autoComplete="email" autoFocus={tab !== 'signup'} valid={email.length > 0 ? emailValid : undefined} ariaLabel="Email" />

              <div className="auth-field">
                <label className="auth-label" htmlFor="pw">Mot de passe</label>
                <div className="auth-input-wrap">
                  <Lock size={18} className="auth-input-icon" />
                  <input id="pw" type={showPw ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder={tab === 'signup' ? 'Min. 8 caractères' : '••••••••'} autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                    aria-label="Mot de passe" className="auth-input" style={{ paddingRight: '44px' }} />
                  <button type="button" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} className="auth-eye">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {tab === 'signup' && password.length > 0 && (
                  <div style={{ marginTop: '8px' }} aria-live="polite">
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                        {[0, 1, 2, 3].map(i => (
                          <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i < strength.filled ? strength.color : 'var(--bg-muted)', transition: 'background 300ms ease, width 300ms ease' }} />
                        ))}
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: strength.color }}>{strength.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
                      <Crit ok={pwChecks.length} label="8 cars" />
                      <Crit ok={pwChecks.upper} label="Majuscule" />
                      <Crit ok={pwChecks.digit} label="Chiffre" />
                    </div>
                  </div>
                )}

                {tab === 'login' && (
                  <button type="button" onClick={() => { setForgot(true); setError(''); }} className="auth-forgot">Mot de passe oublié ?</button>
                )}
              </div>

              {tab === 'signup' && (
                <div className="auth-field">
                  <label className="auth-label" htmlFor="cpw">Confirmer le mot de passe</label>
                  <div className="auth-input-wrap">
                    <Lock size={18} className="auth-input-icon" />
                    <input id="cpw" type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }}
                      placeholder="••••••••" autoComplete="new-password" aria-label="Confirmer le mot de passe" aria-invalid={confirm.length > 0 && !confirmValid}
                      className="auth-input" style={{ paddingRight: '70px', borderColor: confirm.length > 0 ? (confirmValid ? 'var(--success)' : 'var(--danger)') : undefined }} />
                    {confirm.length > 0 && <span style={{ position: 'absolute', right: '44px', top: '50%', transform: 'translateY(-50%)', color: confirmValid ? 'var(--success)' : 'var(--danger)' }}>{confirmValid ? <Check size={16} /> : <XIcon size={16} />}</span>}
                    <button type="button" onClick={() => setShowConfirm(s => !s)} aria-label={showConfirm ? 'Masquer' : 'Afficher'} className="auth-eye">
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {tab === 'login' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ width: '16px', height: '16px' }} /> Rester connecté
                </label>
              )}

              {error && <ErrorMsg msg={error} />}

              <SubmitBtn loading={loading} disabled={!canSubmit} label={submitLabel} style={{ marginTop: '4px' }} />
            </form>

            {/* Separator + demo */}
            <div className="auth-or"><span /><small>ou</small><span /></div>
            <button type="button" onClick={startDemo} className="auth-demo">
              <Gamepad2 size={16} /> Essayer sans compte
            </button>
          </>
        )}

        <style>{AUTH_CSS}</style>
      </div>
    </div>
  );
}

/* ---------- field ---------- */
function Field({ label, Icon, value, onChange, placeholder, type = 'text', autoComplete, valid, autoFocus, ariaLabel }: {
  label: string; Icon: typeof Mail; value: string; onChange: (v: string) => void; placeholder: string; type?: string; autoComplete?: string; valid?: boolean; autoFocus?: boolean; ariaLabel: string;
}) {
  return (
    <div className="auth-field">
      <label className="auth-label">{label}</label>
      <div className="auth-input-wrap">
        <Icon size={18} className="auth-input-icon" />
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete}
          autoFocus={autoFocus} aria-label={ariaLabel} aria-invalid={valid === false} className="auth-input"
          style={{ paddingRight: '40px', borderColor: valid === false ? 'var(--danger)' : valid === true ? 'var(--success)' : undefined }} />
        {valid !== undefined && value.length > 0 && (
          <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: valid ? 'var(--success)' : 'var(--danger)' }}>
            {valid ? <Check size={16} /> : <XIcon size={16} />}
          </span>
        )}
      </div>
    </div>
  );
}

function Crit({ ok, label }: { ok: boolean; label: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: ok ? 'var(--success)' : 'var(--text-light)' }}>{ok ? <Check size={12} /> : <XIcon size={12} />} {label}</span>;
}

function ErrorMsg({ msg }: { msg: string }) {
  return <div role="alert" className="auth-error animate-fade-in"><AlertCircle size={14} style={{ flexShrink: 0 }} /> {msg}</div>;
}

function SubmitBtn({ loading, disabled, label, style }: { loading: boolean; disabled: boolean; label: string; style?: React.CSSProperties }) {
  return (
    <button type="submit" disabled={disabled || loading} className="auth-submit" style={style}>
      {loading ? <><span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.6)', borderRightColor: 'transparent' }} /> {label === 'Se connecter' ? 'Connexion en cours…' : '…'}</> : <>{label} <ArrowRight size={18} /></>}
    </button>
  );
}

const AUTH_CSS = `
.auth-overlay { position: fixed; inset: 0; z-index: 2000; background: rgba(27,22,18,0.55); display: flex; align-items: flex-start; justify-content: center; padding-top: 7vh; overflow-y: auto; }
.auth-modal { position: relative; width: 92%; max-width: 420px; background: var(--bg-card); border-radius: var(--radius-lg); box-shadow: var(--shadow-xl); border: var(--bw) solid var(--border-strong); padding: 32px; margin-bottom: 40px; }
.auth-x { position: absolute; top: 14px; right: 14px; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: none; background: transparent; color: var(--text-muted); border-radius: var(--radius); cursor: pointer; transition: background 200ms ease, color 200ms ease; }
.auth-x:hover { background: var(--interactive); color: var(--text); }
.auth-tabs { position: relative; display: flex; border-bottom: var(--bw) solid var(--border-strong); margin-bottom: 24px; }
.auth-tab { flex: 1; min-height: 44px; padding: 12px 8px; border: none; background: none; cursor: pointer; font-family: var(--font-body); font-weight: 600; font-size: 14px; transition: color 200ms ease; }
.auth-tab-underline { position: absolute; bottom: calc(-1 * var(--bw)); left: 0; width: 50%; height: 3px; background: var(--accent); transition: transform 200ms ease; }
.auth-field { margin-bottom: 16px; }
.auth-label { display: block; font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; }
.auth-input-wrap { position: relative; }
.auth-input-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-light); pointer-events: none; }
.auth-input { width: 100%; height: 52px; border: var(--bw) solid var(--border-strong); border-radius: var(--radius); padding: 0 16px 0 44px; font-size: 15px; font-family: var(--font-body); background: var(--bg-card); color: var(--text); outline: none; transition: border-color 200ms ease, box-shadow 200ms ease; }
.auth-input:focus { border-color: var(--accent); box-shadow: 3px 3px 0 var(--accent-light); }
.auth-eye { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: none; background: transparent; color: var(--text-muted); border-radius: var(--radius); cursor: pointer; }
.auth-eye:hover { background: var(--interactive); color: var(--text); }
.auth-forgot { display: block; margin: 8px 0 0 auto; background: none; border: none; color: var(--accent); font-size: 12px; font-weight: 600; cursor: pointer; text-align: right; padding: 2px; }
.auth-forgot:hover { text-decoration: underline; }
.auth-error { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--danger); margin: 6px 0 12px; }
.auth-submit { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 52px; background: var(--accent); border: var(--bw) solid var(--border-strong); border-radius: var(--radius); color: #fff; font-weight: 700; font-size: 15px; font-family: var(--font-body); cursor: pointer; transition: transform 150ms var(--ease-out), box-shadow 150ms var(--ease-out), opacity 200ms ease; }
.auth-submit:hover:not(:disabled) { transform: translate(-2px,-2px); box-shadow: var(--shadow); background: var(--accent-hover); }
.auth-submit:active:not(:disabled) { transform: translate(0,0); box-shadow: 1px 1px 0 var(--shadow-color); }
.auth-submit:disabled { opacity: 0.45; cursor: not-allowed; }
.auth-or { display: flex; align-items: center; gap: 12px; margin: 20px 0; }
.auth-or span { flex: 1; height: var(--bw); background: var(--border-strong); }
.auth-or small { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-light); }
.auth-demo { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 48px; background: var(--bg-card); border: var(--bw) solid var(--border-strong); border-radius: var(--radius); color: var(--text); font-weight: 600; font-size: 14px; font-family: var(--font-body); cursor: pointer; transition: transform 150ms var(--ease-out), box-shadow 150ms var(--ease-out); }
.auth-demo:hover { transform: translate(-2px,-2px); box-shadow: var(--shadow); }
`;
