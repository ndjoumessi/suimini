'use client';
import { useState } from 'react';
import { FamilyTree } from '@/types';

interface Props {
  tree: FamilyTree;
  onClose: () => void;
}

export default function ShareModal({ tree, onClose }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [includePrivate, setIncludePrivate] = useState(false);

  // Generate a shareable JSON data URL
  const shareData = JSON.stringify({
    ...tree,
    persons: includePrivate ? tree.persons : tree.persons.filter(p => p.privacy !== 'private'),
    sharedAt: new Date().toISOString(),
    sharedBy: 'Suimini',
  }, null, 2);

  const base64 = typeof window !== 'undefined'
    ? btoa(unescape(encodeURIComponent(shareData)))
    : '';
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?import=${base64.slice(0, 200)}…`
    : '';

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2500);
    });
  }

  function downloadJSON() {
    const blob = new Blob([shareData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tree.name.replace(/\s+/g, '_')}_suimini.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const embedCode = `<iframe src="${typeof window !== 'undefined' ? window.location.origin : 'https://suimini.vercel.app'}?tree=${tree.id}" width="100%" height="600" frameborder="0"></iframe>`;

  const stats = `${tree.name} — ${tree.persons.length} personnes, ${tree.relationships.length} relations`;

  const socialText = `🌳 Découvrez l'arbre généalogique de la ${tree.name} sur Suimini !\n${tree.description ? tree.description + '\n' : ''}${stats}`;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '520px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="serif" style={{ margin: 0 }}>🔗 Partager l'arbre</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Tree info */}
          <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '32px' }}>🌳</span>
            <div>
              <div style={{ fontWeight: '700' }}>{tree.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{stats}</div>
            </div>
          </div>

          {/* Privacy option */}
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}>
            <input type="checkbox" checked={includePrivate} onChange={e => setIncludePrivate(e.target.checked)} />
            <span>Inclure les membres marqués «&nbsp;privé&nbsp;»</span>
          </label>

          {/* Download JSON */}
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: '700' }}>
              📦 Fichier exportable
            </div>
            <button onClick={downloadJSON} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
              ⬇ Télécharger {tree.name}.json
            </button>
            <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>
              Partageable avec n'importe qui utilisant Suimini via Import/Export
            </div>
          </div>

          {/* Social share */}
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: '700' }}>
              📱 Partager sur les réseaux
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(socialText)}`}
                target="_blank" rel="noopener noreferrer"
                className="btn btn-sm"
                style={{ background: '#25D366', color: 'white', textDecoration: 'none' }}
              >
                💬 WhatsApp
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(socialText)}`}
                target="_blank" rel="noopener noreferrer"
                className="btn btn-sm"
                style={{ background: '#1877F2', color: 'white', textDecoration: 'none' }}
              >
                📘 Facebook
              </a>
              <a
                href={`mailto:?subject=${encodeURIComponent(`Arbre généalogique : ${tree.name}`)}&body=${encodeURIComponent(socialText + '\n\nFichier joint : téléchargez le fichier .json et importez-le dans Suimini.')}`}
                className="btn btn-sm"
                style={{ background: 'var(--bg-muted)', color: 'var(--text)', border: '1px solid var(--border)', textDecoration: 'none' }}
              >
                📧 Email
              </a>
              <button
                onClick={() => copyToClipboard(socialText, 'social')}
                className="btn btn-sm"
                style={{ background: 'var(--bg-muted)', color: 'var(--text)', border: '1px solid var(--border)' }}
              >
                {copied === 'social' ? '✅ Copié !' : '📋 Copier le texte'}
              </button>
            </div>
          </div>

          {/* Embed code */}
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: '700' }}>
              🖥 Code d'intégration (iframe)
            </div>
            <div style={{ position: 'relative' }}>
              <textarea
                readOnly
                value={embedCode}
                className="input"
                rows={2}
                style={{ resize: 'none', fontSize: '11px', fontFamily: 'monospace', paddingRight: '80px' }}
              />
              <button
                onClick={() => copyToClipboard(embedCode, 'embed')}
                className="btn btn-sm btn-secondary"
                style={{ position: 'absolute', right: '6px', top: '6px' }}
              >
                {copied === 'embed' ? '✅' : '📋 Copier'}
              </button>
            </div>
          </div>

          {/* QR code hint */}
          <div style={{ padding: '10px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '20px' }}>💡</span>
            <span>
              Pour partager lors d'une réunion de famille : exportez le fichier .json et importez-le sur un autre appareil via <strong>📁 Import/Export</strong>.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
