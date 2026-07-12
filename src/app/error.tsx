'use client';
import { useEffect } from 'react';

/**
 * Route-level error boundary (renders inside the root layout). Replaces Next's
 * generic "This page couldn't load" with a recoverable, on-brand fallback —
 * e.g. if a render throws during the post-logout navigation. Self-contained
 * (literal hex, no app context) so it works even when providers are unavailable.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('App error boundary:', error); }, [error]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, textAlign: 'center', background: '#16120e', color: '#f3ecdf' }}>
      <div style={{ width: 40, height: 40, background: '#c9a84c', borderRadius: 10 }} aria-hidden="true" />
      <h1 style={{ margin: 0, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 500, fontSize: 26 }}>
        Une erreur est survenue
      </h1>
      <p style={{ margin: 0, maxWidth: 420, color: '#aa9e8c', fontSize: 14, lineHeight: 1.6 }}>
        Quelque chose n’a pas fonctionné. Réessayez, ou revenez à l’accueil.
        <br /><span style={{ fontSize: 12, opacity: 0.8 }}>Something went wrong. Try again, or go back home.</span>
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={reset} style={{ cursor: 'pointer', border: '1px solid #c9a84c', background: '#c9a84c', color: '#171006', fontWeight: 700, fontSize: 14, padding: '10px 20px', borderRadius: 10 }}>
          Réessayer
        </button>
        <a href="/" style={{ textDecoration: 'none', border: '1px solid #4a4033', background: 'transparent', color: '#f3ecdf', fontSize: 14, padding: '10px 20px', borderRadius: 10 }}>
          Accueil
        </a>
      </div>
    </div>
  );
}
