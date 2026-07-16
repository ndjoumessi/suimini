import { NextResponse } from 'next/server';
import { MEMBER_JOINED_SUBJECT, memberJoinedEmailHtml } from '@/lib/emails';
import { guardTreeRead, checkOrigin } from '@/lib/apiData';

// Server-only: RESEND_API_KEY is never exposed to the browser.
export const runtime = 'nodejs';

const RESEND_URL = 'https://api.resend.com/emails';
const FROM = process.env.RESEND_FROM || 'Suimini <onboarding@resend.dev>';
const APP_BASE = 'https://suimini.vercel.app';

/**
 * POST /api/send-approval-email  { treeId }
 * After a member accepts an invitation, notify the tree OWNER by email.
 * The caller (authenticated user) IS the new member — we never trust client-supplied
 * emails: the owner/member identities are resolved server-side from `treeId`.
 * Profiles can't be read directly across users (RLS: id = auth.uid()), so we resolve
 * emails via the SECURITY DEFINER get_public_profiles() RPC (identité — reste
 * TOUJOURS sur Supabase, y compris pour un arbre backé par Railway).
 * No-ops gracefully (200 { skipped }) on self-join, missing owner email, or no RESEND_API_KEY.
 *
 * Archi F8 : résolvait `trees.name`/`owner_id` par un SELECT Supabase direct —
 * mort depuis le cutover Railway (les arbres réels n'y vivent plus). Le
 * treeId/ownerId passent maintenant par `guardTreeRead` (même AuthZ que les
 * autres endpoints — le membre qui vient d'accepter a un accès `canReadTreeAsMember`)
 * + `store.authz.getTreeOwnerId`/`store.loadOneTree` (backend effectif).
 */
export async function POST(req: Request) {
  const originErr = await checkOrigin();
  if (originErr) return originErr;

  // --- Payload ---
  let body: { treeId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 }); }
  const treeId = body.treeId?.trim();
  if (!treeId) return NextResponse.json({ error: 'treeId manquant.' }, { status: 400 });

  // --- AuthN + AuthZ : le nouveau membre doit avoir accès en lecture (owner |
  // tree_shares | membre accepté) — même backend que les données de l'arbre. ---
  const guard = await guardTreeRead(treeId);
  if (!guard.ok) return guard.res;
  const { client: supabase, caller: user } = guard;

  // --- Résolution de l'arbre (nom + propriétaire), backend effectif ---
  const ownerId = await guard.store.authz.getTreeOwnerId(treeId);
  if (!ownerId) return NextResponse.json({ skipped: true, reason: 'Arbre introuvable.' });
  const tree = await guard.store.loadOneTree(treeId);
  const treeName = tree?.name || 'votre arbre';

  // Joining your own tree → no notification needed.
  if (ownerId === user.userId) return NextResponse.json({ skipped: true, reason: 'self-join' });

  // --- Resolve owner + member identities (RLS-safe SECURITY DEFINER RPC, TOUJOURS Supabase) ---
  const { data: profiles } = await supabase.rpc('get_public_profiles', { ids: [ownerId, user.userId] });
  const rows = (profiles as Array<{ id: string; display_name: string | null; email: string | null }> | null) ?? [];
  const owner = rows.find(p => p.id === ownerId);
  const member = rows.find(p => p.id === user.userId);

  const ownerEmail = owner?.email?.trim();
  if (!ownerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) {
    return NextResponse.json({ skipped: true, reason: 'E-mail propriétaire indisponible.' });
  }
  const memberName = member?.display_name?.trim() || member?.email?.trim() || 'Un nouveau membre';
  const ownerName = owner?.display_name?.trim() || undefined;
  const treeUrl = `${APP_BASE}/app`;

  // --- Send (graceful no-op if no key) ---
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ skipped: true, reason: 'RESEND_API_KEY absent' });

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [ownerEmail],
        subject: MEMBER_JOINED_SUBJECT(memberName, treeName),
        html: memberJoinedEmailHtml({ ownerName, memberName, treeName, treeUrl }),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return NextResponse.json({ error: 'Échec Resend', detail }, { status: 502 });
    }
    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json({ error: 'Erreur réseau (Resend).' }, { status: 502 });
  }
}
