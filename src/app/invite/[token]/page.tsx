'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { supabase } from '@/lib/supabase';
import {
  getInvitation, acceptInvitation, PENDING_INVITE_KEY,
  type InvitationInfo,
} from '@/lib/sharing';
import { TreePine, UserPlus, Clock, ArrowLeft, LogIn } from 'lucide-react';

type PageState =
  | { kind: 'loading' }
  | { kind: 'unauthenticated'; invite: InvitationInfo }
  | { kind: 'valid'; invite: InvitationInfo }
  | { kind: 'accepting' }
  | { kind: 'joined'; treeName: string }
  | { kind: 'expired' }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string };

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const t = useTranslations('members');
  const ti = useTranslations('invite');
  const locale = useLocale();
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  const roleLabel = useCallback(
    (role: string) => (role === 'admin' || role === 'editor' || role === 'viewer' ? t(role) : role),
    [t],
  );

  useEffect(() => {
    if (!supabase || !token) { setState({ kind: 'invalid' }); return; }
    const sb = supabase;
    let active = true;

    (async () => {
      const invite = await getInvitation(token);
      if (!active) return;
      if (!invite) { setState({ kind: 'invalid' }); return; }
      if (invite.status === 'accepted') { router.replace('/app'); return; }
      if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) { setState({ kind: 'expired' }); return; }

      const { data: { user } } = await sb.auth.getUser();
      if (!active) return;
      setState(user ? { kind: 'valid', invite } : { kind: 'unauthenticated', invite });
    })();

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleAccept() {
    setState({ kind: 'accepting' });
    const res = await acceptInvitation(token);
    if (!res) { setState({ kind: 'error', message: t('joinExpired') }); return; }
    // Show a welcome confirmation, then redirect to the app (see effect below).
    setState({ kind: 'joined', treeName: res.treeName });
  }

  // After joining, briefly show the welcome message then redirect to the app.
  useEffect(() => {
    if (state.kind !== 'joined') return;
    const id = setTimeout(() => router.replace('/app'), 2000);
    return () => clearTimeout(id);
  }, [state.kind, router]);

  function goToSignIn(invite: InvitationInfo) {
    // Stash the token so the app auto-accepts right after sign-in (see useAuth).
    try {
      localStorage.setItem(PENDING_INVITE_KEY, token);
      localStorage.setItem('NEXT_LOCALE', locale);
    } catch { /* ignore */ }
    router.push(`/?invite=1&email=${encodeURIComponent(invite.invitedEmail)}`);
  }

  // ─── Styles (Atelier — literal hex fallbacks so the page renders standalone) ──
  const pageStyle: React.CSSProperties = {
    minHeight: '100dvh', backgroundColor: 'var(--bg, #f4f1ea)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '32px 16px', fontFamily: 'var(--font-body, "Hanken Grotesk", sans-serif)',
  };
  const cardStyle: React.CSSProperties = {
    maxWidth: '460px', width: '100%', backgroundColor: 'var(--bg-card, #ffffff)',
    border: '1.5px solid var(--border-strong, #1b1b1b)',
    boxShadow: '6px 6px 0 var(--shadow-color, rgba(27,22,18,0.9))',
    borderRadius: 0, overflow: 'hidden',
  };
  const headerStyle: React.CSSProperties = {
    backgroundColor: 'var(--ink, #1b1b1b)', padding: '16px 28px',
    fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)', color: '#ffffff',
    textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700, fontSize: '13px',
  };
  const bodyStyle: React.CSSProperties = {
    padding: '28px', color: 'var(--text, #1b1b1b)', fontSize: '15px', lineHeight: 1.6,
  };
  const h1Style: React.CSSProperties = {
    margin: '0 0 16px', fontFamily: 'var(--font-display, "Bricolage Grotesque", sans-serif)',
    fontWeight: 700, fontSize: '24px', letterSpacing: '-0.02em',
  };
  const mutedStyle: React.CSSProperties = { color: 'var(--text-muted, #4a4742)', fontSize: '13px' };
  const iconCircle: React.CSSProperties = {
    width: '52px', height: '52px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1.5px solid var(--border-strong, #1b1b1b)', borderRadius: 0,
    background: 'var(--accent-light, #f6e1d8)', color: 'var(--accent, #bf4b2c)',
  };

  function Shell({ children }: { children: React.ReactNode }) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={headerStyle}>SUIMINI</div>
          <div style={bodyStyle}>{children}</div>
        </div>
      </div>
    );
  }

  if (state.kind === 'loading') {
    return <Shell><div style={{ ...mutedStyle, textAlign: 'center', padding: '8px 0' }} role="status"><span className="spinner" aria-hidden="true" /> Chargement…</div></Shell>;
  }

  if (state.kind === 'accepting') {
    return <Shell><div style={{ ...mutedStyle, textAlign: 'center', padding: '8px 0' }} role="status"><span className="spinner" aria-hidden="true" /> {t('joinButton')}…</div></Shell>;
  }

  if (state.kind === 'joined') {
    return (
      <Shell>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <span style={iconCircle} aria-hidden="true"><UserPlus size={24} /></span>
          <div role="status">
            <h1 style={h1Style}>Vous avez rejoint l&apos;arbre «&nbsp;{state.treeName}&nbsp;» !</h1>
            <p style={{ margin: '0 0 8px' }}>Bienvenue dans la famille.</p>
            <p style={{ margin: 0, ...mutedStyle }}><span className="spinner" aria-hidden="true" /> Redirection en cours…</p>
          </div>
        </div>
      </Shell>
    );
  }

  if (state.kind === 'expired') {
    return (
      <Shell>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <span style={{ ...iconCircle, background: 'color-mix(in srgb, var(--danger, #9e2b25) 14%, var(--bg-card, #fff))', color: 'var(--danger, #9e2b25)' }} aria-hidden="true"><Clock size={24} /></span>
          <div>
            <h1 style={h1Style}>{t('joinExpired')}</h1>
            <p style={{ margin: '0 0 20px', ...mutedStyle }}>
              Demandez au propriétaire de l&apos;arbre de vous renvoyer une invitation.
            </p>
            <a href="/" className="btn btn-secondary btn-sm"><ArrowLeft size={14} aria-hidden="true" /> Retour à l&apos;accueil</a>
          </div>
        </div>
      </Shell>
    );
  }

  if (state.kind === 'invalid' || state.kind === 'error') {
    return (
      <Shell>
        <h1 style={h1Style}>{state.kind === 'error' ? 'Une erreur est survenue' : 'Invitation introuvable'}</h1>
        <p style={{ margin: '0 0 20px', ...mutedStyle }}>
          {state.kind === 'error' ? state.message : 'Ce lien d’invitation est invalide ou a déjà été utilisé.'}
        </p>
        <a href="/" className="btn btn-secondary btn-sm"><ArrowLeft size={14} aria-hidden="true" /> Retour à l&apos;accueil</a>
      </Shell>
    );
  }

  // valid | unauthenticated — both show invitation details
  const { invite } = state;
  const expiry = invite.expiresAt
    ? new Date(invite.expiresAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <Shell>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '20px' }}>
        <span style={iconCircle} aria-hidden="true"><TreePine size={26} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted, #4a4742)' }}>
            {invite.inviterName ? t('joinDesc', { inviter: invite.inviterName }) : t('title')}
          </div>
          <h1 style={{ ...h1Style, margin: '2px 0 0' }}>{t('joinTitle', { tree: invite.treeName })}</h1>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '22px' }}>
        <span className="badge badge-accent">{t('role')} : {roleLabel(invite.role)}</span>
        {expiry && (
          <span className="badge" style={{ background: 'var(--bg-muted, #ece7dc)', color: 'var(--text-muted, #4a4742)', borderColor: 'var(--border, #d8d2c6)' }}>
            <Clock size={10} aria-hidden="true" style={{ marginRight: '4px' }} /> {ti('expiresOn')} {expiry}
          </span>
        )}
      </div>

      {state.kind === 'valid' ? (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={handleAccept} className="btn btn-primary"><UserPlus size={16} aria-hidden="true" /> {t('joinButton')}</button>
          <a href="/app" className="btn btn-secondary">{ti('later')}</a>
        </div>
      ) : (
        <div>
          <p style={{ margin: '0 0 14px', ...mutedStyle }}>{t('joinLogin')}</p>
          <button onClick={() => goToSignIn(invite)} className="btn btn-primary"><LogIn size={16} aria-hidden="true" /> {t('joinLogin')}</button>
        </div>
      )}
    </Shell>
  );
}
