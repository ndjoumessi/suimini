'use client';
import { useOverlay } from '@/hooks/useOverlay';
import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { FamilyTree } from '@/types';
import { shareTree, listShares, unshareTree, getPublicShare, setTreePublic } from '@/lib/supabaseSync';
import { useAuth } from '@/hooks/useAuth';
import {
  getTreeMembers, inviteMember, updateMemberRole, removeMember, sharingEnabled,
  type ManagedMember, type MemberRole, type MemberStatus,
} from '@/lib/sharing';
import {
  Share2, X, Cloud, Package, Download, Smartphone, Code2, Lightbulb,
  Mail, Copy, Check, MessageCircle, TreePine, Pencil, Eye, Globe, ExternalLink,
  Users, Trash2, UserPlus,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

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
  /** Owner or accepted admin → can list / re-role / remove members. */
  canManageMembers?: boolean;
  onRequireAuth?: () => void;
  onToast?: (msg: string, type?: string) => void;
  onClose: () => void;
}

/** Status pill colors: pending=amber, accepted=green, declined=red — via signal tokens. */
function statusStyle(status: MemberStatus): React.CSSProperties {
  const token = status === 'accepted' ? '--success' : status === 'declined' ? '--danger' : '--warning';
  return {
    background: `color-mix(in srgb, var(${token}) 14%, var(--bg-card))`,
    color: `var(${token})`,
    borderColor: `var(${token})`,
  };
}

function Eyebrow({ Icon, children }: { Icon: typeof Cloud; children: React.ReactNode }) {
  return (
    <div className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
      <Icon size={13} aria-hidden="true" /> {children}
    </div>
  );
}

/** Initials (max 2 chars) from an email's local part for the avatar. */
function emailInitials(email: string): string {
  const local = email.split('@')[0] || email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return letters.toUpperCase();
}

type Tab = 'share' | 'members';

export default function ShareModal({ tree, cloud, canManageMembers = true, onRequireAuth, onToast, onClose }: Props) {
  const t = useTranslations('sharing');
  const tm = useTranslations('members');
  const locale = useLocale();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('share');

  // Multi-member sharing state. The Members tab is for owners / admins.
  const membersEnabled = sharingEnabled() && !!user && canManageMembers;
  const [members, setMembers] = useState<ManagedMember[]>([]);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<MemberRole>('viewer');
  const [inviting, setInviting] = useState(false);
  const [memberNotice, setMemberNotice] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const refreshMembers = useCallback(async () => {
    const list = await getTreeMembers(tree.id);
    setMembers(list);
  }, [tree.id]);

  useEffect(() => {
    if (!membersEnabled) return;
    let active = true;
    getTreeMembers(tree.id).then(list => { if (active) setMembers(list); });
    return () => { active = false; };
  }, [membersEnabled, tree.id]);

  function notify(msg: string) {
    if (onToast) { onToast(msg, 'success'); return; }
    setMemberNotice(msg);
    setTimeout(() => setMemberNotice(null), 2500);
  }

  const inviterName = (user?.user_metadata?.display_name as string | undefined) || user?.email || undefined;

  async function doInvite() {
    if (!user || inviting) return;
    const email = memberEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setInviteError(t('errEmailInvalid')); onToast?.(t('errEmailInvalid'), 'error'); return; }
    setInviting(true);
    setInviteError(null);
    try {
      const res = await inviteMember(tree.id, email, memberRole, user.id, inviterName, tree.name);
      if (!res) { setInviteError(t('errInviteFailed')); onToast?.(t('errInviteFailed'), 'error'); return; }
      setMemberEmail('');
      setMemberRole('viewer');
      await refreshMembers();
      notify(tm('inviteSuccess', { email }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('errGeneric');
      setInviteError(msg); onToast?.(msg, 'error');
    } finally {
      setInviting(false);
    }
  }

  async function doRemoveMember(email: string) {
    if (typeof window !== 'undefined' && !window.confirm(tm('removeConfirm', { email }))) return;
    const ok = await removeMember(tree.id, email);
    if (!ok) { onToast?.(t('errFailed'), 'error'); return; }
    await refreshMembers();
    notify(t('removed'));
  }

  async function doChangeRole(email: string, role: MemberRole) {
    const ok = await updateMemberRole(tree.id, email, role);
    if (!ok) { onToast?.(t('errFailed'), 'error'); return; }
    await refreshMembers();
    notify(t('roleUpdated'));
  }

  const [copied, setCopied] = useState<string | null>(null);
  const [includePrivate, setIncludePrivate] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePerm, setSharePerm] = useState<'read' | 'write'>('read');
  const [shares, setShares] = useState<{ email: string; permission: string }[]>([]);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
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
    if (error) { onToast?.(t('errPublicUpdate'), 'error'); return; }
    setIsPublic(next);
    if (next && slug) setPublicSlug(slug);
    onToast?.(next ? t('publicEnabled') : t('publicDisabled'), next ? 'success' : 'info');
  }

  async function doShare() {
    if (sharing) return;
    const email = shareEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setShareError(t('errEmailInvalid')); onToast?.(t('errEmailInvalid'), 'error'); return; }
    setSharing(true);
    setShareError(null);
    try {
      const { error } = await shareTree(tree.id, email, sharePerm);
      if (error) { setShareError(t('errShareFailed')); onToast?.(t('errShareFailed'), 'error'); return; }
      setShareEmail('');
      setShares(await listShares(tree.id));
      onToast?.(t('inviteSent', { email }), 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('errGeneric');
      setShareError(msg); onToast?.(msg, 'error');
    } finally {
      setSharing(false);
    }
  }
  async function removeShare(email: string) {
    await unshareTree(tree.id, email);
    setShares(await listShares(tree.id));
    onToast?.(t('shareRemoved'), 'info');
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

  const stats = t('statsLine', { name: tree.name, persons: tree.persons.length, relations: tree.relationships.length });

  const socialText = `${t('socialIntro', { name: tree.name })}\n${tree.description ? tree.description + '\n' : ''}${stats}`;

  const overlayRef = useOverlay(onClose);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={overlayRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('shareTitle')} className="modal" style={{ maxWidth: '520px' }}>
        <div style={{ padding: '20px 24px', borderBottom: 'var(--bw) solid var(--border-strong)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="serif" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Share2 size={20} aria-hidden="true" /> {t('shareTitle')}</h2>
          <button onClick={onClose} aria-label={t('close')} className="btn btn-ghost btn-sm btn-icon"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label={t('tabsAria')} style={{ display: 'flex', gap: '8px', padding: '12px 24px 0', flexWrap: 'wrap' }}>
          <button
            role="tab"
            aria-selected={tab === 'share'}
            onClick={() => setTab('share')}
            className={tab === 'share' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          >
            <Share2 size={14} aria-hidden="true" /> {t('share')}
          </button>
          {canManageMembers && (
            <button
              role="tab"
              aria-selected={tab === 'members'}
              onClick={() => setTab('members')}
              className={tab === 'members' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            >
              <Users size={14} aria-hidden="true" /> {t('members')}
              {membersEnabled && members.length > 0 && (
                <span className="badge" style={{ marginLeft: '4px' }}>{members.length}</span>
              )}
            </button>
          )}
        </div>

        {/* Members tab */}
        <div role="tabpanel" hidden={tab !== 'members'} style={{ padding: '20px 24px', display: tab === 'members' ? 'flex' : 'none', flexDirection: 'column', gap: '16px' }}>
          {!membersEnabled ? (
            <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)', fontSize: '13px', color: 'var(--text-muted)' }}>
              {t('signInToManage')}
              {onRequireAuth && (
                <button onClick={onRequireAuth} className="btn btn-primary btn-sm" style={{ marginTop: '8px', width: '100%', justifyContent: 'center' }}>{t('signIn')}</button>
              )}
            </div>
          ) : (
            <>
              {/* Invite form */}
              <div>
                <Eyebrow Icon={UserPlus}>{t('invite')}</Eyebrow>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <label htmlFor="member-email" className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>{t('email')}</label>
                  <input
                    id="member-email"
                    value={memberEmail}
                    onChange={e => setMemberEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') doInvite(); }}
                    placeholder={t('emailPlaceholder')}
                    className="input"
                    type="email"
                    autoComplete="email"
                    style={{ flex: '1 1 160px', minWidth: 0 }}
                  />
                  <label htmlFor="member-role" className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>{t('role')}</label>
                  <select
                    id="member-role"
                    value={memberRole}
                    onChange={e => setMemberRole(e.target.value as MemberRole)}
                    className="input"
                    style={{ width: 'auto' }}
                  >
                    <option value="viewer">{t('viewer')}</option>
                    <option value="editor">{t('editor')}</option>
                    <option value="admin">{t('admin')}</option>
                  </select>
                  <button onClick={doInvite} disabled={inviting} className="btn btn-primary btn-sm" style={{ opacity: inviting ? 0.7 : undefined }}>
                    {inviting ? <LoadingSpinner size={14} /> : t('invite')}
                  </button>
                </div>
                {memberNotice && (
                  <div role="status" style={{ marginTop: '8px', fontSize: '12px', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Check size={13} aria-hidden="true" /> {memberNotice}
                  </div>
                )}
                {inviteError && <div style={{ marginTop: '8px' }}><ErrorMessage message={inviteError} onRetry={doInvite} /></div>}
              </div>

              {/* Members list */}
              <div>
                <Eyebrow Icon={Users}>{t('members')}</Eyebrow>
                {members.length === 0 ? (
                  <div style={{ padding: '16px 12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    {t('noMembers')}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {members.map(m => (
                      <div key={m.email} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: 'var(--bw) solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', boxShadow: 'var(--shadow)', flexWrap: 'wrap' }}>
                        <span aria-hidden="true" style={{ width: '34px', height: '34px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--accent-light)', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700 }}>
                          {emailInitials(m.email)}
                        </span>
                        <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span className="badge" style={statusStyle(m.status)}>
                              {m.status === 'pending' ? t('pending') : m.status === 'accepted' ? t('accepted') : t('declined')}
                            </span>
                            <span>{new Date(m.invitedAt).toLocaleDateString(locale)}</span>
                          </div>
                        </div>
                        <label htmlFor={`role-${m.email}`} className="label" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>{t('role')}</label>
                        <select
                          id={`role-${m.email}`}
                          value={m.role}
                          onChange={e => doChangeRole(m.email, e.target.value as MemberRole)}
                          className="input"
                          aria-label={`${t('role')} — ${m.email}`}
                          style={{ width: 'auto', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
                        >
                          <option value="viewer">{t('viewer')}</option>
                          <option value="editor">{t('editor')}</option>
                          <option value="admin">{t('admin')}</option>
                        </select>
                        <button
                          onClick={() => doRemoveMember(m.email)}
                          aria-label={`${t('remove')} — ${m.email}`}
                          className="btn btn-ghost btn-sm btn-icon"
                          style={{ color: 'var(--danger)', flexShrink: 0 }}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Share tab */}
        <div role="tabpanel" hidden={tab !== 'share'} style={{ padding: '20px 24px', display: tab === 'share' ? 'flex' : 'none', flexDirection: 'column', gap: '16px' }}>
          {/* Supabase collaboration */}
          <div>
            <Eyebrow Icon={Cloud}>{t('shareWithAccount')}</Eyebrow>
            {!cloud ? (
              <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)', fontSize: '13px', color: 'var(--text-muted)' }}>
                {t('signInToInvite')}
                <button onClick={onRequireAuth} className="btn btn-primary btn-sm" style={{ marginTop: '8px', width: '100%', justifyContent: 'center' }}>{t('signIn')}</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input value={shareEmail} onChange={e => setShareEmail(e.target.value)} placeholder={t('emailPlaceholder')} className="input" type="email" style={{ flex: 1 }} />
                  <select value={sharePerm} onChange={e => setSharePerm(e.target.value as 'read' | 'write')} className="input" style={{ width: 'auto' }}>
                    <option value="read">{t('read')}</option>
                    <option value="write">{t('write')}</option>
                  </select>
                  <button onClick={doShare} disabled={sharing} className="btn btn-primary btn-sm" style={{ opacity: sharing ? 0.7 : undefined }}>{sharing ? <LoadingSpinner size={14} /> : t('invite')}</button>
                </div>
                {shareError && <div style={{ marginTop: '8px' }}><ErrorMessage message={shareError} onRetry={doShare} /></div>}
                {shares.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                    {shares.map(s => (
                      <div key={s.email} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '6px 8px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)' }}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</span>
                        <span className="badge badge-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{s.permission === 'write' ? <><Pencil size={10} /> {t('write')}</> : <><Eye size={10} /> {t('read')}</>}</span>
                        <button onClick={() => removeShare(s.email)} aria-label={t('removeShare')} className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }}><X size={14} /></button>
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
              <Eyebrow Icon={Globe}>{t('publicLink')}</Eyebrow>
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
                  <span style={{ display: 'block', fontWeight: 700, fontSize: '13px' }}>{t('makePublic')}</span>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {t('publicDesc')}
                  </span>
                </span>
              </label>

              {isPublic && publicSlug && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <input readOnly value={publicUrl} className="input" style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12px' }} onFocus={e => e.currentTarget.select()} />
                  <button onClick={() => copyToClipboard(publicUrl, 'public')} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
                    {copied === 'public' ? <><Check size={14} /> {t('copied')}</> : <><Copy size={14} /> {t('copy')}</>}
                  </button>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm btn-icon" aria-label={t('openPublicLink')} title={t('open')}><ExternalLink size={14} /></a>
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
            <span>{t('includePrivate')}</span>
          </label>

          {/* Download JSON */}
          <div>
            <Eyebrow Icon={Package}>{t('exportableFile')}</Eyebrow>
            <button onClick={downloadJSON} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
              <Download size={15} /> {t('downloadJson', { name: tree.name })}
            </button>
            <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>
              {t('exportableDesc')}
            </div>
          </div>

          {/* Social share */}
          <div>
            <Eyebrow Icon={Smartphone}>{t('shareSocial')}</Eyebrow>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a href={`https://wa.me/?text=${encodeURIComponent(socialText)}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm" style={{ background: '#25D366', color: 'white', textDecoration: 'none' }}>
                <MessageCircle size={14} /> WhatsApp
              </a>
              <a href={`https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(socialText)}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm" style={{ background: '#1877F2', color: 'white', textDecoration: 'none' }}>
                <Share2 size={14} /> Facebook
              </a>
              <a href={`mailto:?subject=${encodeURIComponent(t('mailSubject', { name: tree.name }))}&body=${encodeURIComponent(socialText + '\n\n' + t('mailNote'))}`} className="btn btn-sm btn-secondary">
                <Mail size={14} /> Email
              </a>
              <button onClick={() => copyToClipboard(socialText, 'social')} className="btn btn-sm btn-secondary">
                {copied === 'social' ? <><Check size={14} /> {t('copiedExcl')}</> : <><Copy size={14} /> {t('copyText')}</>}
              </button>
            </div>
          </div>

          {/* Embed code */}
          <div>
            <Eyebrow Icon={Code2}>{t('embedCode')}</Eyebrow>
            <div style={{ position: 'relative' }}>
              <textarea readOnly value={embedCode} className="input" rows={2} style={{ resize: 'none', fontSize: '11px', fontFamily: 'var(--font-mono)', paddingRight: '92px' }} />
              <button onClick={() => copyToClipboard(embedCode, 'embed')} className="btn btn-sm btn-secondary" style={{ position: 'absolute', right: '6px', top: '6px' }}>
                {copied === 'embed' ? <Check size={14} /> : <><Copy size={14} /> {t('copy')}</>}
              </button>
            </div>
          </div>

          {/* Tip */}
          <div style={{ padding: '10px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <Lightbulb size={18} style={{ flexShrink: 0, color: 'var(--warning)' }} aria-hidden="true" />
            <span>
              {t.rich('familyMeetingTip', { b: (c) => <strong>{c}</strong> })}
            </span>
          </div>
        </div>
        <style>{`.modal .btn-primary svg.animate-spin { color: #fff !important; }`}</style>
      </div>
    </div>
  );
}
