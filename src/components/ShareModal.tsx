'use client';
import { useOverlay } from '@/hooks/useOverlay';
import { useState, useEffect } from 'react';
import { FamilyTree } from '@/types';
import { shareTree, listShares, unshareTree, getPublicShare, setTreePublic } from '@/lib/supabaseSync';
import {
  Share2, X, Cloud, Package, Download, Smartphone, Code2, Lightbulb,
  Mail, Copy, Check, MessageCircle, TreePine, Pencil, Eye, Globe, ExternalLink,
} from 'lucide-react';

/** URL-safe slug from the tree name + a short random suffix for uniqueness. */
function makeSlug(name: string): string {
  const base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'arbre';
  const rand = Math.random().toString(36).slice(2, 6);
  return `${base}-${rand}`;
}

interface Props {
  tree: FamilyTree;
  cloud?: boolean;
  onRequireAuth?: () => void;
  onToast?: (msg: string, type?: string) => void;
  onClose: () => void;
}

function Eyebrow({ Icon, children }: { Icon: typeof Cloud; children: React.ReactNode }) {
  return (
    <div className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
      <Icon size={13} aria-hidden="true" /> {children}
    </div>
  );
}

export default function ShareModal({ tree, cloud, onRequireAuth, onToast, onClose }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [includePrivate, setIncludePrivate] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePerm, setSharePerm] = useState<'read' | 'write'>('read');
  const [shares, setShares] = useState<{ email: string; permission: string }[]>([]);
  const [sharing, setSharing] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [publicSlug, setPublicSlug] = useState<string | null>(null);
  const [togglingPublic, setTogglingPublic] = useState(false);

  useEffect(() => {
    if (cloud) {
      listShares(tree.id).then(setShares);
      getPublicShare(tree.id).then(({ isPublic, slug }) => { setIsPublic(isPublic); setPublicSlug(slug); });
    }
  }, [cloud, tree.id]);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://suimini.vercel.app';
  const publicUrl = publicSlug ? `${origin}/arbre/${publicSlug}` : '';

  async function togglePublic(next: boolean) {
    setTogglingPublic(true);
    const slug = next ? (publicSlug || makeSlug(tree.name)) : publicSlug;
    const { error } = await setTreePublic(tree.id, next, slug);
    setTogglingPublic(false);
    if (error) { onToast?.('Échec de la mise à jour du partage public', 'error'); return; }
    setIsPublic(next);
    if (next && slug) setPublicSlug(slug);
    onToast?.(next ? 'Arbre rendu public' : 'Partage public désactivé', next ? 'success' : 'info');
  }

  async function doShare() {
    const email = shareEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { onToast?.('E-mail invalide', 'error'); return; }
    setSharing(true);
    const { error } = await shareTree(tree.id, email, sharePerm);
    setSharing(false);
    if (error) { onToast?.('Échec du partage', 'error'); return; }
    setShareEmail('');
    setShares(await listShares(tree.id));
    onToast?.(`Invitation envoyée à ${email}`, 'success');
  }
  async function removeShare(email: string) {
    await unshareTree(tree.id, email);
    setShares(await listShares(tree.id));
    onToast?.('Partage retiré', 'info');
  }

  // Generate a shareable JSON data URL
  const shareData = JSON.stringify({
    ...tree,
    persons: includePrivate ? tree.persons : tree.persons.filter(p => p.privacy !== 'private'),
    sharedAt: new Date().toISOString(),
    sharedBy: 'Suimini',
  }, null, 2);

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

  const socialText = `Découvrez l'arbre généalogique de la ${tree.name} sur Suimini !\n${tree.description ? tree.description + '\n' : ''}${stats}`;

  const overlayRef = useOverlay(onClose);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={overlayRef} tabIndex={-1} className="modal" style={{ maxWidth: '520px' }}>
        <div style={{ padding: '20px 24px', borderBottom: 'var(--bw) solid var(--border-strong)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="serif" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Share2 size={20} aria-hidden="true" /> Partager l&apos;arbre</h2>
          <button onClick={onClose} aria-label="Fermer" className="btn btn-ghost btn-sm btn-icon"><X size={16} /></button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Supabase collaboration */}
          <div>
            <Eyebrow Icon={Cloud}>Partager avec un compte</Eyebrow>
            {!cloud ? (
              <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)', fontSize: '13px', color: 'var(--text-muted)' }}>
                Connectez-vous pour inviter des proches à collaborer en temps réel.
                <button onClick={onRequireAuth} className="btn btn-primary btn-sm" style={{ marginTop: '8px', width: '100%', justifyContent: 'center' }}>Se connecter</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input value={shareEmail} onChange={e => setShareEmail(e.target.value)} placeholder="email@exemple.com" className="input" type="email" style={{ flex: 1 }} />
                  <select value={sharePerm} onChange={e => setSharePerm(e.target.value as 'read' | 'write')} className="input" style={{ width: 'auto' }}>
                    <option value="read">Lecture</option>
                    <option value="write">Écriture</option>
                  </select>
                  <button onClick={doShare} disabled={sharing} className="btn btn-primary btn-sm">{sharing ? '…' : 'Inviter'}</button>
                </div>
                {shares.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                    {shares.map(s => (
                      <div key={s.email} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '6px 8px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)' }}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</span>
                        <span className="badge badge-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{s.permission === 'write' ? <><Pencil size={10} /> Écriture</> : <><Eye size={10} /> Lecture</>}</span>
                        <button onClick={() => removeShare(s.email)} aria-label="Retirer le partage" className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }}><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Public read-only link */}
          {cloud && (
            <div>
              <Eyebrow Icon={Globe}>Lien public (lecture seule)</Eyebrow>
              <label style={{ display: 'flex', gap: '10px', alignItems: 'center', cursor: togglingPublic ? 'wait' : 'pointer', padding: '10px 12px', border: 'var(--bw) solid var(--border-strong)', borderRadius: 'var(--radius)', background: isPublic ? 'var(--accent-light)' : 'var(--bg-card)' }}>
                <input
                  type="checkbox"
                  role="switch"
                  checked={isPublic}
                  disabled={togglingPublic}
                  onChange={e => togglePublic(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', flexShrink: 0 }}
                />
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: '13px' }}>Rendre cet arbre public</span>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Toute personne disposant du lien pourra consulter l&apos;arbre, sans pouvoir le modifier.
                  </span>
                </span>
              </label>

              {isPublic && publicSlug && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <input readOnly value={publicUrl} className="input" style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12px' }} onFocus={e => e.currentTarget.select()} />
                  <button onClick={() => copyToClipboard(publicUrl, 'public')} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
                    {copied === 'public' ? <><Check size={14} /> Copié</> : <><Copy size={14} /> Copier</>}
                  </button>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm btn-icon" aria-label="Ouvrir le lien public" title="Ouvrir"><ExternalLink size={14} /></a>
                </div>
              )}
            </div>
          )}

          <hr className="divider" style={{ margin: 0 }} />

          {/* Tree info */}
          <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ width: '44px', height: '44px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--accent-light)', color: 'var(--accent)' }}><TreePine size={22} aria-hidden="true" /></span>
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
            <Eyebrow Icon={Package}>Fichier exportable</Eyebrow>
            <button onClick={downloadJSON} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
              <Download size={15} /> Télécharger {tree.name}.json
            </button>
            <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>
              Partageable avec n&apos;importe qui utilisant Suimini via Import/Export
            </div>
          </div>

          {/* Social share */}
          <div>
            <Eyebrow Icon={Smartphone}>Partager sur les réseaux</Eyebrow>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a href={`https://wa.me/?text=${encodeURIComponent(socialText)}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm" style={{ background: '#25D366', color: 'white', textDecoration: 'none' }}>
                <MessageCircle size={14} /> WhatsApp
              </a>
              <a href={`https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(socialText)}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm" style={{ background: '#1877F2', color: 'white', textDecoration: 'none' }}>
                <Share2 size={14} /> Facebook
              </a>
              <a href={`mailto:?subject=${encodeURIComponent(`Arbre généalogique : ${tree.name}`)}&body=${encodeURIComponent(socialText + '\n\nFichier joint : téléchargez le fichier .json et importez-le dans Suimini.')}`} className="btn btn-sm btn-secondary">
                <Mail size={14} /> Email
              </a>
              <button onClick={() => copyToClipboard(socialText, 'social')} className="btn btn-sm btn-secondary">
                {copied === 'social' ? <><Check size={14} /> Copié !</> : <><Copy size={14} /> Copier le texte</>}
              </button>
            </div>
          </div>

          {/* Embed code */}
          <div>
            <Eyebrow Icon={Code2}>Code d&apos;intégration (iframe)</Eyebrow>
            <div style={{ position: 'relative' }}>
              <textarea readOnly value={embedCode} className="input" rows={2} style={{ resize: 'none', fontSize: '11px', fontFamily: 'var(--font-mono)', paddingRight: '92px' }} />
              <button onClick={() => copyToClipboard(embedCode, 'embed')} className="btn btn-sm btn-secondary" style={{ position: 'absolute', right: '6px', top: '6px' }}>
                {copied === 'embed' ? <Check size={14} /> : <><Copy size={14} /> Copier</>}
              </button>
            </div>
          </div>

          {/* Tip */}
          <div style={{ padding: '10px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <Lightbulb size={18} style={{ flexShrink: 0, color: 'var(--warning)' }} aria-hidden="true" />
            <span>
              Pour partager lors d&apos;une réunion de famille : exportez le fichier .json et importez-le sur un autre appareil via <strong>Import/Export</strong>.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
