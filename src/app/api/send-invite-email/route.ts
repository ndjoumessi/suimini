import { NextResponse } from 'next/server';
import { INVITE_SUBJECT, inviteEmailHtml } from '@/lib/notifications/emails';
import { guardTreeWrite } from '@/lib/data/apiData';
import { enforceRateLimit } from '@/lib/notifications/rateLimit';

// Server-only: RESEND_API_KEY is never exposed to the browser.
export const runtime = 'nodejs';

const RESEND_URL = 'https://api.resend.com/emails';
const FROM = process.env.RESEND_FROM || 'Suimini <onboarding@resend.dev>';
const APP_BASE = 'https://suimini.vercel.app';

/**
 * POST /api/send-invite-email  { treeId, email, inviterName, treeName, token }
 * Sends a tree-member invitation email.
 *
 * Sécu F5 : l'appelant DOIT être propriétaire de `treeId` (guardTreeWrite
 * 'owner', même backend que les données — Supabase ou Railway). Avant ce
 * correctif, la route faisait confiance à `inviterName`/`treeName` fournis
 * par le client sans revérifier de lien réel vers un arbre — n'importe quel
 * utilisateur authentifié pouvait déclencher un email référençant un arbre
 * qui n'était pas le sien. Le token d'invitation lui-même reste généré en
 * amont par `inviteMember` (owner-only, RLS/authz applicative) ; ce check
 * protège spécifiquement CET envoi d'email.
 * No-ops gracefully (200 { skipped }) when RESEND_API_KEY is not configured.
 */
export async function POST(req: Request) {
  // --- Payload ---
  let body: { treeId?: string; email?: string; inviterName?: string; treeName?: string; token?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 }); }

  const treeId = body.treeId?.trim();
  if (!treeId) return NextResponse.json({ error: 'Arbre manquant.' }, { status: 400 });

  // --- AuthN + AuthZ : propriétaire de l'arbre uniquement ---
  const guard = await guardTreeWrite(treeId, 'owner');
  if (!guard.ok) return guard.res;

  const limited = await enforceRateLimit(req, '/api/send-invite-email');
  if (limited) return limited;

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
