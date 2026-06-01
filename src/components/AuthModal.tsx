'use client';
import { useOverlay } from '@/hooks/useOverlay';
import { useState } from 'react';

interface Props {
  onClose: () => void;
  onSignIn: (email: string) => Promise<{ error?: string }>;
  configured: boolean;
}

export default function AuthModal({ onClose, onSignIn, configured }: Props) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Veuillez saisir une adresse e-mail valide.');
      return;
    }
    setStatus('sending'); setError('');
    const { error } = await onSignIn(email.trim());
    if (error) { setError(error); setStatus('idle'); }
    else setStatus('sent');
  }

  const overlayRef = useOverlay(onClose);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={overlayRef} tabIndex={-1} className="modal" style={{ maxWidth: '420px' }}>
        <div style={{ padding: '24px 24px 8px', textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: '1.8rem', color: 'var(--accent)' }}>🌿 Suimini</div>
          <h2 className="serif" style={{ margin: '12px 0 4px', fontSize: '1.3rem' }}>Connexion</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
            Recevez un lien magique par e-mail — aucun mot de passe.
          </p>
        </div>

        <div style={{ padding: '16px 24px 24px' }}>
          {!configured ? (
            <div style={{ padding: '14px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              ⚠️ La synchronisation cloud n&apos;est pas configurée. Renseignez
              <code> NEXT_PUBLIC_SUPABASE_URL </code> et
              <code> NEXT_PUBLIC_SUPABASE_ANON_KEY </code> dans <code>.env.local</code>.
              <div style={{ marginTop: '12px' }}>
                <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                  Continuer en mode invité
                </button>
              </div>
            </div>
          ) : status === 'sent' ? (
            <div style={{ textAlign: 'center', padding: '12px' }} className="animate-fade-in">
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>📧</div>
              <p style={{ fontSize: '14px', margin: '0 0 6px', fontWeight: 700 }}>Lien envoyé !</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 4px' }}>
                Vérifiez votre boîte mail (<strong>{email}</strong>) et cliquez le lien pour vous connecter.
                Vous pouvez fermer cette fenêtre.
              </p>
              <button onClick={onClose} className="btn btn-primary btn-sm" style={{ marginTop: '10px' }}>Fermer</button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <input
                autoFocus type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="vous@exemple.com" className="input"
                style={{ marginBottom: '10px' }}
              />
              {error && <div style={{ color: 'var(--danger)', fontSize: '12px', marginBottom: '10px' }}>{error}</div>}
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={status === 'sending'}>
                {status === 'sending' ? '⏳ Envoi…' : '✉️ Recevoir le lien de connexion'}
              </button>
              <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
                Continuer sans compte (mode invité)
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
