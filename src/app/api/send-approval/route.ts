import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { APPROVED_SUBJECT, approvedEmailHtml } from '@/lib/emails';

// Server-only: RESEND_API_KEY is never exposed to the browser.
export const runtime = 'nodejs';

const RESEND_URL = 'https://api.resend.com/emails';
// Use a verified domain in production; the Resend sandbox sender works for tests.
const FROM = process.env.RESEND_FROM || 'Suimini <onboarding@resend.dev>';

/**
 * POST /api/send-approval  { email, displayName? }
 * Sends the "compte activé" email. Caller MUST be an authenticated admin/superadmin.
 * No-ops gracefully (200 { skipped }) when RESEND_API_KEY is not configured, so the
 * approval flow never breaks just because email isn't set up yet.
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 500 });

  // --- AuthN/AuthZ: only an admin/superadmin may trigger emails ---
  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: { getAll() { return cookieStore.getAll(); }, setAll() { /* read-only here */ } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  const { data: profile, error: profErr } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role?: string } | null)?.role;
  const isAdmin = role === 'admin' || role === 'superadmin' || profErr?.code === '42703';
  if (!isAdmin) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });

  // --- Payload ---
  let body: { email?: string; displayName?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 }); }
  const email = body.email?.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail invalide.' }, { status: 400 });
  }

  // --- Send (graceful no-op if no key) ---
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ skipped: true, reason: 'RESEND_API_KEY absent' });

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [email], subject: APPROVED_SUBJECT, html: approvedEmailHtml(body.displayName) }),
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
