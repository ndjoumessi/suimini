'use client';
import { useOverlay } from '@/hooks/useOverlay';
import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { FamilyTree } from '@/types';
import { shareTree, listShares, unshareTree, getPublicShare, setTreePublic } from '@/lib/supabaseSync';
import { useAuth } from '@/hooks/useAuth';
import { BrandMark } from '@/components/Brand';
import {
  getTreeMembers, inviteMember, updateMemberRole, removeMember, sharingEnabled,
  type ManagedMember, type MemberRole, type MemberStatus,
} from '@/lib/sharing';
import {
  Share2, X, Download, Code2, Lightbulb, Mail, Copy, Check, MessageCircle,
  Pencil, Eye, ExternalLink, Users, Trash2, UserPlus, ChevronRight, ArrowRight,
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

/** Recessed input/select tone — sits darker than the card surface so fields read
 *  as inset wells. No exact token (between --bg and --bg-card), so a literal. */
const RECESS = '#1a1a24';

/** Status pill colors: pending=amber, accepted=green, declined=red — via signal tokens. */
function statusStyle(status: MemberStatus): React.CSSProperties {
  const token = status === 'accepted' ? '--success' : status === 'declined' ? '--danger' : '--warning';
  return {
    background: `color-mix(in srgb, var(${token}) 14%, var(--bg-card))`,
    color: `var(${token})`,
    borderColor: `var(${token})`,
  };
}

/** Section header for the Share tab: mono, uppercase, muted gold. No icon — the
 *  section content carries the meaning; the label just files it. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600,
      letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--accent-text)',
      opacity: 0.92, marginBottom: '10px',
    }}>
      {children}
    </div>
  );
}

/** Members-tab eyebrow (icon + label) — kept for that panel's denser layout. */
function Eyebrow({ Icon, children }: { Icon: typeof Users; children: React.ReactNode }) {
  return (
    <div className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
      <Icon size={13} aria-hidden="true" /> {children}
    </div>
  );
}

/** Square custom toggle (no native checkbox). Whole row is the control; the box
 *  fills gold with a check when on. `desc` clamps to 2 lines. */
function SquareToggle({
  checked, disabled, onChange, label, desc, compact,
}: {
  checked: boolean; disabled?: boolean; onChange: (next: boolean) => void;
  label: string; desc?: string; compact?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="sq-toggle"
      style={{
        display: 'flex', gap: '12px', alignItems: desc ? 'flex-start' : 'center',
        width: '100%', textAlign: 'left',
        padding: compact ? '10px 12px' : '14px',
        background: checked ? 'var(--accent-light)' : 'var(--bg-card)',
        border: `var(--bw) solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
        cursor: disabled ? 'wait' : 'pointer',
        transition: 'background .15s ease, border-color .15s ease',
      }}
    >
      <span aria-hidden="true" style={{
        width: '20px', height: '20px', flexShrink: 0, marginTop: desc ? '1px' : 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: checked ? 'var(--accent)' : 'transparent',
        border: `2px solid ${checked ? 'var(--accent)' : 'var(--border-strong)'}`,
        color: 'var(--ink-on-accent)', transition: 'background .15s ease, border-color .15s ease',
      }}>
        {checked && <Check size={14} strokeWidth={3} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>{label}</span>
        {desc && (
          <span style={{
            fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
            marginTop: '4px', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{desc}</span>
        )}
      </span>
    </button>
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
  const [embedOpen, setEmbedOpen] = useState(false);

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

  const embedCode = `<iframe src="${origin}?tree=${tree.id}" width="100%" height="600" frameborder="0"></iframe>`;

  const stats = t('statsLine', { name: tree.name, persons: tree.persons.length, relations: tree.relationships.length });
  const statsShort = t('statsShort', { persons: tree.persons.length, relations: tree.relationships.length });

  const socialText = `${t('socialIntro', { name: tree.name })}\n${tree.description ? tree.description + '\n' : ''}${stats}`;

  const overlayRef = useOverlay(onClose);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={overlayRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('shareTitle')} className="modal" style={{ maxWidth: '520px' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: 'var(--bw) solid var(--border-strong)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <h2 className="serif" style={{ margin: 0, fontSize: '1.8rem', lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: '9px' }}>
              <Share2 size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} aria-hidden="true" /> {t('shareTitle')}
            </h2>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.6px', color: 'var(--accent-text)', opacity: 0.85, marginTop: '6px' }}>
              {t('subtitle')}
            </div>
          </div>
          <button onClick={onClose} aria-label={t('close')} className="btn btn-ghost btn-sm btn-icon" style={{ flexShrink: 0 }}><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label={t('tabsAria')} style={{ display: 'flex', gap: '8px', padding: '14px 24px 0', flexWrap: 'wrap' }}>
          <button role="tab" aria-selected={tab === 'share'} onClick={() => setTab('share')} className={`share-tab ${tab === 'share' ? 'is-active' : ''}`}>
            <Share2 size={14} aria-hidden="true" /> {t('share')}
          </button>
          {canManageMembers && (
            <button role="tab" aria-selected={tab === 'members'} onClick={() => setTab('members')} className={`share-tab ${tab === 'members' ? 'is-active' : ''}`}>
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
            <div className="share-info">
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
                    className="input field-recessed"
                    type="email"
                    autoComplete="email"
                    style={{ flex: '1 1 160px', minWidth: 0, background: RECESS }}
                  />
                  <label htmlFor="member-role" className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>{t('role')}</label>
                  <select
                    id="member-role"
                    value={memberRole}
                    onChange={e => setMemberRole(e.target.value as MemberRole)}
                    className="input field-recessed"
                    style={{ width: 'auto', background: RECESS }}
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
                  <div className="share-info" style={{ textAlign: 'center' }}>
                    {t('noMembers')}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {members.map(m => (
                      <div key={m.email} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: 'var(--bw) solid var(--border)', background: 'var(--bg-card)', flexWrap: 'wrap' }}>
                        <span aria-hidden="true" style={{ width: '34px', height: '34px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--border-strong)', background: 'var(--accent-light)', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700 }}>
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
                          className="input field-recessed"
                          aria-label={`${t('role')} — ${m.email}`}
                          style={{ width: 'auto', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', background: RECESS }}
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
        <div role="tabpanel" hidden={tab !== 'share'} style={{ padding: '20px 24px', display: tab === 'share' ? 'flex' : 'none', flexDirection: 'column', gap: '22px' }}>

          {/* Section 1 — Invite by email */}
          <div>
            <SectionLabel>{t('inviteByEmail')}</SectionLabel>
            {!cloud ? (
              <div className="share-info">
                {t('signInToInvite')}
                <button onClick={onRequireAuth} className="btn btn-primary btn-sm" style={{ marginTop: '8px', width: '100%', justifyContent: 'center' }}>{t('signIn')}</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <input value={shareEmail} onChange={e => setShareEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') doShare(); }} placeholder={t('emailPlaceholder')} aria-label={t('emailPlaceholder')} autoComplete="email" className="input field-recessed" type="email" style={{ flex: '1 1 160px', minWidth: 0, background: RECESS }} />
                  <select value={sharePerm} onChange={e => setSharePerm(e.target.value as 'read' | 'write')} aria-label={t('permissionAria')} className="input field-recessed" style={{ width: 'auto', background: RECESS }}>
                    <option value="read">{t('read')}</option>
                    <option value="write">{t('write')}</option>
                  </select>
                  <button onClick={doShare} disabled={sharing} aria-busy={sharing} className="btn btn-primary btn-sm" style={{ opacity: sharing ? 0.7 : undefined }}>
                    {sharing ? <><LoadingSpinner size={14} /><span className="sr-only">{t('invite')}</span></> : <>{t('invite')} <ArrowRight size={14} aria-hidden="true" /></>}
                  </button>
                </div>
                {shareError && <div style={{ marginTop: '8px' }}><ErrorMessage message={shareError} onRetry={doShare} /></div>}
                {shares.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px' }}>
                    {shares.map(s => (
                      <div key={s.email} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '7px 10px', background: 'var(--bg-card)', border: 'var(--bw) solid var(--border)' }}>
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

          {/* Section 2 — Public read-only link */}
          {cloud && (
            <div>
              <SectionLabel>{t('publicLink')}</SectionLabel>
              <SquareToggle
                checked={isPublic}
                disabled={togglingPublic}
                onChange={togglePublic}
                label={t('makePublic')}
                desc={t('publicDesc')}
              />
              {isPublic && publicSlug && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <input readOnly value={publicUrl} className="input field-recessed" style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-text)', background: RECESS }} onFocus={e => e.currentTarget.select()} />
                  <button onClick={() => copyToClipboard(publicUrl, 'public')} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
                    {copied === 'public' ? <><Check size={14} /> {t('copied')}</> : <><Copy size={14} /> {t('copy')}</>}
                  </button>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm btn-icon" aria-label={t('openPublicLink')} title={t('open')}><ExternalLink size={14} /></a>
                </div>
              )}
            </div>
          )}

          {/* Section 3 — Tree preview */}
          <div>
            <SectionLabel>{t('treePreview')}</SectionLabel>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '14px', background: 'var(--bg-card)', border: 'var(--bw) solid var(--border)' }}>
              <span style={{ width: '44px', height: '44px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--border-strong)', background: RECESS }}>
                <BrandMark size={26} surface={RECESS} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="serif" style={{ fontSize: '14px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tree.name}</div>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '2px' }}>{statsShort}</div>
              </div>
            </div>
          </div>

          {/* Section 4 — Export */}
          <div>
            <SectionLabel>{t('exportLabel')}</SectionLabel>
            <button onClick={downloadJSON} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
              <Download size={15} /> {t('downloadJson', { name: tree.name })}
            </button>
            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-light)', marginTop: '6px', textAlign: 'center' }}>
              {t('exportCompat')}
            </div>
            <div style={{ marginTop: '8px' }}>
              <SquareToggle compact checked={includePrivate} onChange={setIncludePrivate} label={t('includePrivate')} />
            </div>
          </div>

          {/* Section 5 — Share (uniform, no brand colours) */}
          <div>
            <SectionLabel>{t('shareLabel')}</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              <a href={`https://wa.me/?text=${encodeURIComponent(socialText)}`} target="_blank" rel="noopener noreferrer" className="share-btn">
                <MessageCircle size={15} aria-hidden="true" /> WhatsApp
              </a>
              <a href={`https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(socialText)}`} target="_blank" rel="noopener noreferrer" className="share-btn">
                <Share2 size={15} aria-hidden="true" /> Facebook
              </a>
              <a href={`mailto:?subject=${encodeURIComponent(t('mailSubject', { name: tree.name }))}&body=${encodeURIComponent(socialText + '\n\n' + t('mailNote'))}`} className="share-btn">
                <Mail size={15} aria-hidden="true" /> Email
              </a>
              <button onClick={() => copyToClipboard(socialText, 'social')} className="share-btn">
                {copied === 'social' ? <><Check size={15} aria-hidden="true" /> {t('copiedExcl')}</> : <><Copy size={15} aria-hidden="true" /> {t('copyText')}</>}
              </button>
            </div>
          </div>

          {/* Section 6 — Embed (collapsible) */}
          <div>
            <button
              type="button"
              className="embed-summary"
              aria-expanded={embedOpen}
              onClick={() => setEmbedOpen(o => !o)}
            >
              <ChevronRight size={14} aria-hidden="true" style={{ transform: embedOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s ease' }} />
              <Code2 size={14} aria-hidden="true" />
              {t('embedToggle')}
            </button>
            {embedOpen && (
              <div style={{ position: 'relative', marginTop: '8px' }}>
                <textarea readOnly value={embedCode} className="input field-recessed" rows={2} style={{ resize: 'none', fontSize: '11px', fontFamily: 'var(--font-mono)', paddingRight: '92px', background: RECESS }} />
                <button onClick={() => copyToClipboard(embedCode, 'embed')} className="btn btn-sm btn-secondary" style={{ position: 'absolute', right: '6px', top: '6px' }}>
                  {copied === 'embed' ? <Check size={14} /> : <><Copy size={14} /> {t('copy')}</>}
                </button>
              </div>
            )}
          </div>

          {/* Tip */}
          <div style={{ padding: '12px 14px', background: 'var(--accent-light)', border: 'var(--bw) solid color-mix(in srgb, var(--accent) 40%, transparent)', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <Lightbulb size={18} style={{ flexShrink: 0, color: 'var(--accent)' }} aria-hidden="true" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', lineHeight: 1.55 }}>
              {t.rich('familyMeetingTip', { b: (c) => <strong style={{ color: 'var(--text)' }}>{c}</strong> })}
            </span>
          </div>
        </div>

        <style>{`
          .modal .btn-primary svg.animate-spin { color: #fff !important; }

          .share-tab {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 8px 14px; font-family: var(--font-body); font-size: 12px; font-weight: 700;
            border: var(--bw) solid var(--border); background: var(--bg-card); color: var(--text-muted);
            cursor: pointer; transition: background .15s ease, color .15s ease, border-color .15s ease;
          }
          .share-tab:hover { color: var(--text); border-color: var(--border-strong); }
          .share-tab.is-active { background: var(--accent); color: var(--ink-on-accent); border-color: var(--accent); }
          .share-tab.is-active svg { color: var(--ink-on-accent); }

          .share-info {
            padding: 12px; background: var(--bg-card); border: var(--bw) solid var(--border);
            font-size: 13px; color: var(--text-muted);
          }

          .modal .field-recessed:focus {
            border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); outline: none;
          }

          .sq-toggle:not(:disabled):hover { border-color: var(--accent); }
          .sq-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

          .share-btn {
            display: inline-flex; align-items: center; justify-content: center; gap: 8px;
            padding: 11px 12px; font-family: var(--font-body); font-size: 13px; font-weight: 600;
            background: var(--bg-card); border: var(--bw) solid var(--border); color: var(--text);
            cursor: pointer; text-decoration: none;
            transition: background .15s ease, border-color .15s ease;
          }
          .share-btn:hover { background: var(--bg-muted); border-color: var(--accent); }
          .share-btn svg { color: var(--text-muted); transition: color .15s ease; }
          .share-btn:hover svg { color: var(--accent); }

          .embed-summary {
            display: inline-flex; align-items: center; gap: 7px;
            padding: 6px 2px; background: transparent; border: none; cursor: pointer;
            font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.4px;
            color: var(--text-muted); text-transform: none;
            transition: color .15s ease;
          }
          .embed-summary:hover { color: var(--accent); }
          .embed-summary svg { color: inherit; }
        `}</style>
      </div>
    </div>
  );
}
