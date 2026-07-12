'use client';
import { useEffect } from 'react';

/**
 * Root error boundary — catches errors thrown in the root layout itself
 * (e.g. the i18n provider), where `error.tsx` can't help because it renders
 * inside that layout. Must provide its own <html>/<body>. Self-contained.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Global error boundary:', error); }, [error]);

  return (
    <html lang="fr">
      <body style={{ margin: 0 }}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, textAlign: 'center', background: '#171310', color: '#f3ecdf', fontFamily: 'system-ui, sans-serif' }}>
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
      </body>
    </html>
  );
}
