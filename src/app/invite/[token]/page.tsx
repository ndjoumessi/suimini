'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

interface InviteInfo {
  id: string;
  treeName: string;
  role: string;
  expiresAt: string | null;
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'valid'; invite: InviteInfo }
  | { kind: 'accepting' }
  | { kind: 'expired' }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string };

const ROLE_LABELS: Record<string, string> = {
  viewer: 'Lecteur',
  editor: 'Éditeur',
  admin: 'Administrateur',
};

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey || !token) {
      setState({ kind: 'invalid' });
      return;
    }

    const supabase = createBrowserClient(supabaseUrl, supabaseKey);

    async function loadInvite() {
      const supabase = createBrowserClient(supabaseUrl!, supabaseKey!);

      // Check auth first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState({ kind: 'unauthenticated' });
        return;
      }

      // Load invitation with tree name
      const { data, error } = await supabase
        .from('tree_members')
        .select('id, role, expires_at, status, trees(name)')
        .eq('token', token)
        .single();

      if (error || !data) {
        setState({ kind: 'invalid' });
        return;
      }

      const row = data as unknown as {
        id: string;
        role: string;
        expires_at: string | null;
        status: string;
        trees: { name: string } | { name: string }[] | null;
      };

      // Check expiry
      if (row.expires_at && new Date(row.expires_at) < new Date()) {
        setState({ kind: 'expired' });
        return;
      }

      // Already accepted
      if (row.status === 'accepted') {
        router.replace('/app');
        return;
      }

      setState({
        kind: 'valid',
        invite: {
          id: row.id,
          treeName: (Array.isArray(row.trees) ? row.trees[0]?.name : row.trees?.name) ?? 'Arbre inconnu',
          role: row.role,
          expiresAt: row.expires_at,
        },
      });
    }

    loadInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleAccept() {
    if (!supabaseUrl || !supabaseKey || state.kind !== 'valid') return;
    setState({ kind: 'accepting' });

    const supabase = createBrowserClient(supabaseUrl, supabaseKey);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setState({ kind: 'unauthenticated' }); return; }

    const { error } = await supabase
      .from('tree_members')
      .update({ status: 'accepted', user_id: user.id, accepted_at: new Date().toISOString() })
      .eq('token', token);

    if (error) {
      setState({ kind: 'error', message: error.message });
      return;
    }

    router.replace('/app');
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: 'var(--bg, #f4f1ea)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    fontFamily: 'var(--font-body, "Hanken Grotesk", Arial, sans-serif)',
  };

  const cardStyle: React.CSSProperties = {
    maxWidth: '480px',
    width: '100%',
    backgroundColor: 'var(--bg-card, #faf9f6)',
    border: '2px solid var(--border-strong, #1b1b1b)',
    boxShadow: '4px 4px 0 var(--border-strong, #1b1b1b)',
    borderRadius: 0,
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: 'var(--ink, #1b1b1b)',
    padding: '20px 28px',
    fontFamily: 'var(--font-display, "Bricolage Grotesque", Arial, sans-serif)',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    fontWeight: 700,
    fontSize: '18px',
  };

  const bodyStyle: React.CSSProperties = {
    padding: '32px 28px',
    color: 'var(--ink, #1b1b1b)',
    fontSize: '15px',
    lineHeight: 1.6,
  };

  const btnPrimaryStyle: React.CSSProperties = {
    backgroundColor: 'var(--accent, #bf4b2c)',
    color: '#ffffff',
    border: '2px solid var(--border-strong, #1b1b1b)',
    boxShadow: '4px 4px 0 var(--border-strong, #1b1b1b)',
    borderRadius: 0,
    padding: '12px 24px',
    fontFamily: 'var(--font-display, "Bricolage Grotesque", Arial, sans-serif)',
    fontWeight: 700,
    fontSize: '15px',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
  };

  const btnSecondaryStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    color: 'var(--ink, #1b1b1b)',
    border: '2px solid var(--border-strong, #1b1b1b)',
    boxShadow: '2px 2px 0 var(--border-strong, #1b1b1b)',
    borderRadius: 0,
    padding: '10px 20px',
    fontFamily: 'var(--font-display, "Bricolage Grotesque", Arial, sans-serif)',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
    marginTop: '12px',
  };

  const mutedStyle: React.CSSProperties = {
    color: 'var(--ink-muted, #6b6560)',
    fontSize: '13px',
  };

  if (state.kind === 'loading') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={headerStyle}>SUIMINI</div>
          <div style={{ ...bodyStyle, ...mutedStyle, textAlign: 'center' }}>
            Chargement de l'invitation…
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === 'unauthenticated') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={headerStyle}>SUIMINI</div>
          <div style={bodyStyle}>
            <h1 style={{ margin: '0 0 16px', fontFamily: 'var(--font-display, "Bricolage Grotesque", Arial, sans-serif)', fontWeight: 700, fontSize: '22px' }}>
              Invitation reçue
            </h1>
            <p style={{ margin: '0 0 24px' }}>
              Connectez-vous ou créez un compte pour accepter cette invitation.
            </p>
            <a href="/" style={btnPrimaryStyle}>
              Se connecter →
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === 'expired') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={headerStyle}>SUIMINI</div>
          <div style={bodyStyle}>
            <h1 style={{ margin: '0 0 16px', fontFamily: 'var(--font-display, "Bricolage Grotesque", Arial, sans-serif)', fontWeight: 700, fontSize: '22px' }}>
              Invitation expirée
            </h1>
            <p style={{ margin: '0 0 24px', ...mutedStyle }}>
              Cette invitation a expiré. Demandez au propriétaire de l'arbre de vous renvoyer une invitation.
            </p>
            <a href="/" style={btnSecondaryStyle}>← Retour à l'accueil</a>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === 'invalid') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={headerStyle}>SUIMINI</div>
          <div style={bodyStyle}>
            <h1 style={{ margin: '0 0 16px', fontFamily: 'var(--font-display, "Bricolage Grotesque", Arial, sans-serif)', fontWeight: 700, fontSize: '22px' }}>
              Invitation introuvable
            </h1>
            <p style={{ margin: '0 0 24px', ...mutedStyle }}>
              Ce lien d'invitation est invalide ou a déjà été utilisé.
            </p>
            <a href="/" style={btnSecondaryStyle}>← Retour à l'accueil</a>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={headerStyle}>SUIMINI</div>
          <div style={bodyStyle}>
            <h1 style={{ margin: '0 0 16px', fontFamily: 'var(--font-display, "Bricolage Grotesque", Arial, sans-serif)', fontWeight: 700, fontSize: '22px' }}>
              Une erreur est survenue
            </h1>
            <p style={{ margin: '0 0 24px', ...mutedStyle }}>{state.message}</p>
            <a href="/" style={btnSecondaryStyle}>← Retour à l'accueil</a>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === 'accepting') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={headerStyle}>SUIMINI</div>
          <div style={{ ...bodyStyle, ...mutedStyle, textAlign: 'center' }}>
            Acceptation en cours…
          </div>
        </div>
      </div>
    );
  }

  // state.kind === 'valid'
  const { invite } = state;
  const roleLabel = ROLE_LABELS[invite.role] ?? invite.role;

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>SUIMINI</div>
        <div style={bodyStyle}>
          <h1 style={{ margin: '0 0 16px', fontFamily: 'var(--font-display, "Bricolage Grotesque", Arial, sans-serif)', fontWeight: 700, fontSize: '24px' }}>
            Rejoindre l'arbre
          </h1>
          <p style={{ margin: '0 0 8px' }}>
            Vous avez été invité(e) à collaborer sur l'arbre généalogique :
          </p>
          <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '18px', color: 'var(--accent, #bf4b2c)' }}>
            {invite.treeName}
          </p>
          <p style={{ margin: '0 0 24px', ...mutedStyle }}>
            Rôle : <strong style={{ color: 'var(--ink, #1b1b1b)' }}>{roleLabel}</strong>
            {invite.expiresAt && (
              <>
                {' · '}Expire le{' '}
                {new Date(invite.expiresAt).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </>
            )}
          </p>
          <button onClick={handleAccept} style={btnPrimaryStyle}>
            Accepter l'invitation →
          </button>
          <div>
            <a href="/" style={btnSecondaryStyle}>Décliner</a>
          </div>
        </div>
      </div>
    </div>
  );
}
