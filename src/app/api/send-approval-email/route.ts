import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { MEMBER_JOINED_SUBJECT, memberJoinedEmailHtml } from '@/lib/emails';

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
 * emails via the SECURITY DEFINER get_public_profiles() RPC.
 * No-ops gracefully (200 { skipped }) on self-join, missing owner email, or no RESEND_API_KEY.
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 500 });

  // --- AuthN: the new member must be authenticated ---
  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: { getAll() { return cookieStore.getAll(); }, setAll() { /* read-only here */ } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  // --- Payload ---
  let body: { treeId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 }); }
  const treeId = body.treeId?.trim();
  if (!treeId) return NextResponse.json({ error: 'treeId manquant.' }, { status: 400 });

  // --- Resolve tree (name + owner). Member has read access via RLS. ---
  const { data: tree } = await supabase
    .from('trees')
    .select('name, owner_id')
    .eq('id', treeId)
    .single();
  const ownerId = (tree as { name?: string; owner_id?: string } | null)?.owner_id;
  const treeName = (tree as { name?: string } | null)?.name || 'votre arbre';
  if (!ownerId) return NextResponse.json({ skipped: true, reason: 'Arbre introuvable.' });

  // Joining your own tree → no notification needed.
  if (ownerId === user.id) return NextResponse.json({ skipped: true, reason: 'self-join' });

  // --- Resolve owner + member identities (RLS-safe SECURITY DEFINER RPC) ---
  const { data: profiles } = await supabase.rpc('get_public_profiles', { ids: [ownerId, user.id] });
  const rows = (profiles as Array<{ id: string; display_name: string | null; email: string | null }> | null) ?? [];
  const owner = rows.find(p => p.id === ownerId);
  const member = rows.find(p => p.id === user.id);

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
