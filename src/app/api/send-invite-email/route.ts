import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { INVITE_SUBJECT, inviteEmailHtml } from '@/lib/emails';

// Server-only: RESEND_API_KEY is never exposed to the browser.
export const runtime = 'nodejs';

const RESEND_URL = 'https://api.resend.com/emails';
const FROM = process.env.RESEND_FROM || 'Suimini <onboarding@resend.dev>';
const APP_BASE = 'https://suimini.vercel.app';

/**
 * POST /api/send-invite-email  { email, inviterName, treeName, token }
 * Sends a tree-member invitation email. Caller MUST be authenticated (any user may
 * invite — ownership check is handled at the inviteMember layer).
 * No-ops gracefully (200 { skipped }) when RESEND_API_KEY is not configured.
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 500 });

  // --- AuthN: any authenticated user may send an invite ---
  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: { getAll() { return cookieStore.getAll(); }, setAll() { /* read-only here */ } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  // --- Payload ---
  let body: { email?: string; inviterName?: string; treeName?: string; token?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 }); }

  const email = body.email?.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail invalide.' }, { status: 400 });
  }
  const inviterName = body.inviterName?.trim() || 'Quelqu\'un';
  const treeName = body.treeName?.trim() || 'un arbre généalogique';
  const token = body.token?.trim();
  if (!token) return NextResponse.json({ error: 'Token manquant.' }, { status: 400 });

  const inviteUrl = `${APP_BASE}/invite/${token}`;

  // --- Send (graceful no-op if no key) ---
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ skipped: true, reason: 'RESEND_API_KEY absent' });

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: INVITE_SUBJECT(inviterName, treeName),
        html: inviteEmailHtml(inviterName, treeName, inviteUrl),
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
