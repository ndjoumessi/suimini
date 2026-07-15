'use client';
import { useState, useId } from 'react';
import { useTranslations } from 'next-intl';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Gamepad2, Check, X as XIcon, ArrowLeft, Building2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOverlay } from '@/hooks/useOverlay';
import { passwordChecks, strengthInfo } from '@/lib/password';
import { BrandMark } from './Brand';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

type Tab = 'login' | 'signup';
interface Props {
  onClose: () => void;
  initialTab?: Tab;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function AuthModal({ onClose, initialTab = 'login' }: Props) {
  const tr = useTranslations('auth');
  const { signUp, signIn, resetPassword, signInWithMagicLink, startDemo } = useAuth();
  const overlayRef = useOverlay<HTMLDivElement>(onClose);

  const [tab, setTab] = useState<Tab>(initialTab);
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [organization, setOrganization] = useState('');
  // Décochée par défaut (pas pré-cochée avant toute saisie) — cohérent avec
  // mobile/app/(auth)/login.tsx. Reste sans effet sur la durée de session
  // Supabase (voir signIn ci-dessous) — cosmétique des deux côtés pour l'instant.
  const [remember, setRemember] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentMsg, setSentMsg] = useState('');

  const emailValid = EMAIL_RE.test(email.trim());
  const pwChecks = passwordChecks(password);
  const strength = strengthInfo(password);
  const pwValid = password.length >= 8;
  const confirmValid = confirm.length > 0 && confirm === password;

  function switchTab(t: Tab) { setTab(t); setForgot(false); setError(''); setSentMsg(''); }

  async function handleMagicLink() {
    if (!emailValid) { setError(tr('errorEmailInvalid')); return; }
    setError('');
    setMagicLoading(true);
    const { error } = await signInWithMagicLink(email);
    setMagicLoading(false);
    if (error) setError(error);
    else setSentMsg(tr('successMagicSent'));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (forgot) {
      if (!emailValid) { setError(tr('errorEmailInvalid')); return; }
      setLoading(true);
      const { error } = await resetPassword(email);
      setLoading(false);
      if (error) setError(error);
      else setSentMsg(tr('successResetSent'));
      return;
    }
    if (tab === 'login') {
      if (!emailValid || !password) { setError(tr('errorMissingCredentials')); return; }
      setLoading(true);
      // Safety net: never leave the button stuck on "Connexion en cours…" if the
      // sign-in promise hangs or navigation is blocked.
      const safety = setTimeout(() => setLoading(false), 10000);
      try {
        const { error } = await signIn(email, password);
        if (error) {
          clearTimeout(safety); setLoading(false);
          const localized = /incorrect|invalid/i.test(error) ? tr('errorInvalidCredentials')
            : /confirm/i.test(error) ? tr('errorEmailNotConfirmed')
            : error;
          setError(localized);
          return;
        }
        clearTimeout(safety);
        onClose();
        window.location.href = '/app';
      } catch {
        clearTimeout(safety);
        setLoading(false);
        setError(tr('errorConnection'));
      }
      return;
    }
    // signup
    if (!displayName.trim()) { setError(tr('errorMissingName')); return; }
    if (!emailValid) { setError(tr('errorEmailInvalid')); return; }
    if (!pwValid) { setError(tr('errorPasswordTooShort')); return; }
    if (!confirmValid) { setError(tr('errorPasswordMismatch')); return; }
    setLoading(true);
    const { error } = await signUp(email, password, displayName, organization);
    setLoading(false);
    if (error) setError(error);
    else setSentMsg(tr('successSignupSent'));
  }

  const canSubmit = forgot ? emailValid
    : tab === 'login' ? (emailValid && password.length > 0)
      : (displayName.trim().length > 0 && emailValid && pwValid && confirmValid);

  const submitLabel = forgot ? tr('sendLink') : tab === 'login' ? tr('loginButton') : tr('signupButton');

  return (
    <div className="auth-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div ref={overlayRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={tr('modalAria')} className="auth-modal animate-scale-in">
        <button onClick={onClose} aria-label={tr('close')} className="auth-x"><XIcon size={20} /></button>

        {/* Header — logo + wordmark + tagline + gold rule */}
        <div className="auth-head">
          <div className="auth-brand">
            <BrandMark size={36} color="var(--ink-on-accent)" accent="var(--ink-on-accent)" surface="var(--accent)" />
            <span className="auth-brand-name serif">Suimini</span>
          </div>
          <p className="auth-tagline">{tr('tagline')}</p>
        </div>

        {sentMsg ? (
          <div className="animate-fade-in">
            <AuthSuccess message={sentMsg} />
            <button onClick={onClose} className="auth-submit" style={{ marginTop: '18px' }}>{tr('close')} <ArrowRight size={18} /></button>
          </div>
        ) : forgot ? (
          <form onSubmit={handleSubmit}>
            <button type="button" onClick={() => { setForgot(false); setError(''); }} className="auth-back"><ArrowLeft size={14} /> {tr('back')}</button>
            <h3 className="serif" style={{ margin: '0 0 4px', fontSize: '1.15rem', color: 'var(--ink)' }}>{tr('forgotTitle')}</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px', lineHeight: 1.5 }}>{tr('forgotDesc')}</p>
            <Field label={tr('email')} Icon={Mail} type="email" value={email} onChange={setEmail} placeholder={tr('emailPlaceholder')} autoComplete="email" autoFocus valid={email.length > 0 ? emailValid : undefined} ariaLabel="Email" />
            {error && <div className="animate-fade-in" style={{ margin: '10px 0 0' }}><AuthError message={error} /></div>}
            <SubmitBtn loading={loading} disabled={!canSubmit} label={tr('sendLink')} style={{ marginTop: '18px' }} />
          </form>
        ) : (
          <>
            {/* Tabs — gold underline on the active one, no coloured fill */}
            <div role="tablist" className="auth-tabs">
              {([['login', tr('login')], ['signup', tr('signup')]] as [Tab, string][]).map(([t, lbl]) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => switchTab(t)}
                  className={`auth-tab ${tab === t ? 'auth-tab-on' : ''}`}>
                  {lbl}
                </button>
              ))}
              <span className="auth-tab-underline" style={{ transform: tab === 'login' ? 'translateX(0)' : 'translateX(100%)' }} />
            </div>

            <form onSubmit={handleSubmit}>
              {tab === 'signup' && (
                <Field label={tr('displayName')} Icon={User} value={displayName} onChange={setDisplayName} placeholder={tr('displayNamePlaceholder')} autoComplete="name" autoFocus valid={displayName.trim().length > 0 ? true : undefined} ariaLabel={tr('displayName')} />
              )}

              {tab === 'signup' && (
                <Field label={tr('organization')} Icon={Building2} value={organization} onChange={setOrganization} placeholder={tr('organizationPlaceholder')} autoComplete="organization" ariaLabel={tr('organizationAria')} />
              )}

              <Field label={tr('email')} Icon={Mail} type="email" value={email} onChange={setEmail} placeholder={tr('emailPlaceholder')} autoComplete="email" autoFocus={tab !== 'signup'} valid={email.length > 0 ? emailValid : undefined} ariaLabel="Email" />

              <div className="auth-field">
                <label className="auth-label" htmlFor="pw">{tr('password')}</label>
                <div className="auth-input-wrap">
                  <Lock size={16} className="auth-input-icon" />
                  <input id="pw" type={showPw ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder={tab === 'signup' ? tr('passwordPlaceholderSignup') : '••••••••'} autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                    className="auth-input" style={{ paddingRight: '44px' }} />
                  <button type="button" onClick={() => setShowPw(s => !s)} aria-label={showPw ? tr('hidePassword') : tr('showPassword')} aria-pressed={showPw} className="auth-eye">
                    {showPw ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>

                {tab === 'signup' && password.length > 0 && (
                  <div style={{ marginTop: '10px' }} aria-live="polite">
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '7px' }}>
                      <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                        {[0, 1, 2, 3].map(i => (
                          <div key={i} style={{ flex: 1, height: '3px', borderRadius: 'var(--radius-full)', background: i < strength.filled ? strength.color : 'var(--border)', transition: 'background 300ms ease' }} />
                        ))}
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', color: strength.color }}>{strength.labelKey ? tr(strength.labelKey) : ''}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      <Crit ok={pwChecks.length} label={tr('critLength')} />
                      <Crit ok={pwChecks.upper} label={tr('critUpper')} />
                      <Crit ok={pwChecks.digit} label={tr('critDigit')} />
                    </div>
                  </div>
                )}

                {tab === 'login' && (
                  <button type="button" onClick={() => { setForgot(true); setError(''); }} className="auth-forgot">{tr('forgotPassword')}</button>
                )}
              </div>

              {tab === 'signup' && (
                <div className="auth-field">
                  <label className="auth-label" htmlFor="cpw">{tr('confirmPassword')}</label>
                  <div className="auth-input-wrap">
                    <Lock size={16} className="auth-input-icon" />
                    <input id="cpw" type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }}
                      placeholder="••••••••" autoComplete="new-password" aria-label={tr('confirmPassword')} aria-invalid={confirm.length > 0 && !confirmValid}
                      className="auth-input" style={{ paddingRight: '70px', borderColor: confirm.length > 0 ? (confirmValid ? 'var(--success)' : 'var(--danger)') : undefined }} />
                    {confirm.length > 0 && <span style={{ position: 'absolute', right: '44px', top: '50%', transform: 'translateY(-50%)', color: confirmValid ? 'var(--success)' : 'var(--danger)' }}>{confirmValid ? <Check size={16} /> : <XIcon size={16} />}</span>}
                    <button type="button" onClick={() => setShowConfirm(s => !s)} aria-label={showConfirm ? tr('hide') : tr('show')} className="auth-eye">
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {tab === 'login' && (
                <label className="auth-remember">
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> {tr('rememberMe')}
                </label>
              )}

              {error && <div className="animate-fade-in" style={{ margin: '12px 0' }}><AuthError message={error} /></div>}

              <SubmitBtn loading={loading} disabled={!canSubmit} label={submitLabel} loadingLabel={tab === 'login' ? tr('loginLoading') : undefined} style={{ marginTop: '6px' }} />
            </form>

            {/* Separator */}
            <div className="auth-or"><span /><small>{tr('orSeparator')}</small><span /></div>

            {/* Magic link (login only) + demo */}
            {tab === 'login' && (
              <button type="button" onClick={handleMagicLink} disabled={magicLoading} className="auth-ghost">
                {magicLoading ? <LoadingSpinner size={16} /> : <>{tr('magicLinkButton')} <ArrowRight size={15} /></>}
              </button>
            )}
            <button type="button" onClick={startDemo} className="auth-ghost auth-demo">
              <Gamepad2 size={16} /> {tr('tryDemo')}
            </button>
          </>
        )}

        <style>{AUTH_CSS}</style>
      </div>
    </div>
  );
}

/* ---------- field ---------- */
function Field({ label, Icon, value, onChange, placeholder, type = 'text', autoComplete, valid, autoFocus }: {
  label: string; Icon: typeof Mail; value: string; onChange: (v: string) => void; placeholder: string; type?: string; autoComplete?: string; valid?: boolean; autoFocus?: boolean; ariaLabel?: string;
}) {
  // Association programmatique label ↔ input (1.3.1) : le nom accessible EST le
  // libellé visible (2.5.3) — l'ancien aria-label parallèle est retiré.
  const id = useId();
  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={id}>{label}</label>
      <div className="auth-input-wrap">
        <Icon size={16} className="auth-input-icon" aria-hidden="true" />
        <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete}
          autoFocus={autoFocus} aria-invalid={valid === false} className="auth-input"
          style={{ paddingRight: '40px', borderColor: valid === false ? 'var(--danger)' : valid === true ? 'var(--success)' : undefined }} />
        {valid !== undefined && value.length > 0 && (
          <span aria-hidden="true" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: valid ? 'var(--success)' : 'var(--danger)' }}>
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

function AuthError({ message }: { message: string }) {
  return <div role="alert" className="auth-msg auth-msg-err"><AlertCircle size={15} aria-hidden="true" /><span>{message}</span></div>;
}
function AuthSuccess({ message }: { message: string }) {
  return <div role="status" className="auth-msg auth-msg-ok"><CheckCircle2 size={15} aria-hidden="true" /><span>{message}</span></div>;
}

function SubmitBtn({ loading, disabled, label, loadingLabel, style }: { loading: boolean; disabled: boolean; label: string; loadingLabel?: string; style?: React.CSSProperties }) {
  // En chargement, le bouton garde TOUJOURS un nom accessible (loadingLabel
  // visible, sinon le label en sr-only) + aria-busy — un spinner seul (aria-hidden)
  // laissait un bouton sans nom pendant la soumission.
  return (
    <button type="submit" disabled={disabled || loading} aria-busy={loading} className="auth-submit" style={style}>
      {loading ? <LoadingSpinner size={18} className="auth-submit-spinner" /> : <>{label} <ArrowRight size={18} aria-hidden="true" /></>}
      {loading && (loadingLabel
        ? <span style={{ marginLeft: 8 }}>{loadingLabel}</span>
        : <span className="sr-only">{label}</span>)}
    </button>
  );
}

const AUTH_CSS = `
.auth-overlay { position: fixed; inset: 0; z-index: 2000; background: var(--scrim, rgba(23,19,16,0.72)); display: flex; align-items: flex-start; justify-content: center; padding-top: 7vh; overflow-y: auto; }
.auth-modal { position: relative; width: 92%; max-width: 480px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--shadow-xl); padding: 40px; margin-bottom: 40px; }

/* close */
.auth-x { position: absolute; top: 16px; right: 16px; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: none; border-radius: var(--radius-sm); background: transparent; color: var(--text-muted); cursor: pointer; transition: color 200ms ease; }
.auth-x:hover { color: var(--ink); }

/* header */
.auth-head { text-align: center; padding-bottom: 22px; margin-bottom: 24px; border-bottom: 1px solid var(--accent); }
.auth-brand { display: inline-flex; align-items: center; gap: 11px; }
.auth-brand-name { font-family: var(--font-display); font-style: italic; font-weight: 500; font-size: 20px; letter-spacing: 0; color: var(--ink); }
.auth-tagline { margin: 12px 0 0; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent-muted); }

/* back link (forgot view) */
.auth-back { display: inline-flex; align-items: center; gap: 6px; margin: 0 0 14px; padding: 0; background: none; border: none; cursor: pointer; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.04em; color: var(--text-muted); transition: color 200ms ease; }
.auth-back:hover { color: var(--accent-text); }

/* tabs */
.auth-tabs { position: relative; display: flex; border-bottom: 1px solid var(--border); margin-bottom: 26px; }
.auth-tab { flex: 1; min-height: 44px; padding: 12px 8px; border: none; background: none; cursor: pointer; font-family: var(--font-body); font-weight: 600; font-size: 14px; color: var(--text-muted); transition: color 200ms ease; }
.auth-tab-on { color: var(--accent); }
.auth-tab-underline { position: absolute; bottom: -1px; left: 0; width: 50%; height: 2px; background: var(--accent); transition: transform 200ms ease; }

/* fields */
.auth-field { margin-bottom: 16px; }
.auth-label { display: block; font-family: var(--font-mono); font-size: 10px; font-weight: 700; color: var(--accent-muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 7px; }
.auth-input-wrap { position: relative; }
.auth-input-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
.auth-input { width: 100%; height: 48px; border: 1px solid var(--border); border-radius: var(--radius); padding: 0 16px 0 42px; font-size: 15px; font-family: var(--font-body); background: var(--bg-card); color: var(--ink); outline: none; transition: border-color 200ms ease, box-shadow 200ms ease; }
.auth-input::placeholder { color: var(--text-light); }
/* focus: 2px gold border, no glow (inset shadow thickens the 1px border without layout shift) */
.auth-input:focus { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.auth-eye { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: none; background: transparent; color: var(--text-muted); cursor: pointer; transition: color 200ms ease; }
.auth-eye:hover { color: var(--ink); }

/* forgot link */
.auth-forgot { display: block; margin: 6px 0 0 auto; padding: 6px 4px; min-height: 32px; background: none; border: none; cursor: pointer; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.03em; color: var(--accent-muted); text-align: right; transition: color 200ms ease; }
.auth-forgot:hover { color: var(--accent-text); }

/* remember */
.auth-remember { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; font-size: 13px; color: var(--text-muted); cursor: pointer; }
.auth-remember input { width: 16px; height: 16px; accent-color: var(--accent); }

/* messages */
.auth-msg { display: flex; align-items: center; gap: 8px; padding: 11px 14px; border-radius: var(--radius); font-size: 13px; line-height: 1.4; font-family: var(--font-body); }
.auth-msg svg { flex-shrink: 0; }
.auth-msg-err { background: #1A0A0A; border: 1px solid #5a2a2a; color: #ef9a9a; }
.auth-msg-ok { background: #0A1A0A; border: 1px solid #2f5a3f; color: #86c79b; }

/* submit CTA */
.auth-submit { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 48px; background: var(--accent); border: none; border-radius: var(--radius); color: var(--ink-on-accent); font-weight: 700; font-size: 14px; font-family: var(--font-body); cursor: pointer; transition: filter 150ms ease, opacity 200ms ease; }
.auth-submit:hover:not(:disabled) { background: var(--accent-hover); }
/* Disabled (inactive form) reads as a clear neutral button — never a muddy,
   half-transparent gold that clashes with the vivid --accent used elsewhere.
   While submitting (aria-busy) the CTA keeps its gold identity. */
.auth-submit:disabled { cursor: not-allowed; }
.auth-submit:disabled:not([aria-busy="true"]) { background: var(--bg-muted); color: var(--text-light); }
.auth-submit[aria-busy="true"] { opacity: 0.85; }
.auth-submit-spinner { color: var(--ink-on-accent) !important; }

/* separator */
.auth-or { display: flex; align-items: center; gap: 12px; margin: 22px 0 14px; }
.auth-or span { flex: 1; height: 1px; background: var(--border); }
.auth-or small { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-muted); }

/* ghost buttons (magic link + demo) */
.auth-ghost { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 46px; background: transparent; border: 1px solid var(--border); border-radius: var(--radius); color: var(--text-muted); font-weight: 600; font-size: 14px; font-family: var(--font-body); cursor: pointer; transition: border-color 200ms ease, color 200ms ease; }
.auth-ghost:hover:not(:disabled) { border-color: var(--accent); color: var(--ink); }
.auth-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
/* Demo = tertiary action: borderless, discreet — below the outlined magic-link
   button so the trio reads filled → outline → text (decreasing weight). */
.auth-demo { margin-top: 8px; height: 42px; border-color: transparent; color: var(--text-light); }
.auth-demo:hover:not(:disabled) { border-color: transparent; background: var(--bg-muted); color: var(--ink); }
`;
