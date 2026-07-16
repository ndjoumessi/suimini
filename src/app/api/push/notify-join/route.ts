import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { type ExpoPushMessage, type PushLocale, memberJoinedPushMessage, sendExpoPush } from '@/lib/push';
import { checkOrigin } from '@/lib/apiData';

// Server-only. Node runtime (fetch vers l'API Expo + Supabase).
export const runtime = 'nodejs';

/**
 * POST /api/push/notify-join  { treeId }
 *
 * Pendant PUSH de /api/send-approval-email : quand un membre accepte une
 * invitation, notifie le PROPRIÉTAIRE de l'arbre sur ses appareils mobiles.
 * Best-effort — appelé en fire-and-forget depuis acceptInvitation() (lib/sharing.ts) ;
 * un échec ne doit JAMAIS casser l'adhésion.
 *
 * L'appelant authentifié EST le nouveau membre. Les identités (propriétaire,
 * membre) sont résolues côté serveur depuis treeId (jamais depuis le client).
 * La RLS de push_tokens (user_id = auth.uid()) empêche le membre de lire les
 * tokens du propriétaire → passage par la RPC SECURITY DEFINER scopée
 * get_tree_owner_push_targets (migration 0019).
 *
 * No-op gracieux (200 { skipped }) : self-join, arbre introuvable, propriétaire
 * sans token, ou Supabase non configuré.
 */
export async function POST(req: Request) {
  const originErr = await checkOrigin();
  if (originErr) return originErr;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 500 });

  // --- AuthN : le nouveau membre doit être authentifié ---
  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: { getAll() { return cookieStore.getAll(); }, setAll() { /* read-only ici */ } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  // --- Payload ---
  let body: { treeId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 }); }
  const treeId = body.treeId?.trim();
  if (!treeId) return NextResponse.json({ error: 'treeId manquant.' }, { status: 400 });

  // --- Résolution de l'arbre (nom + propriétaire) ; le membre y a accès (RLS) ---
  const { data: tree } = await supabase
    .from('trees')
    .select('name, owner_id')
    .eq('id', treeId)
    .single();
  const ownerId = (tree as { name?: string; owner_id?: string } | null)?.owner_id;
  const treeName = (tree as { name?: string } | null)?.name || 'votre arbre';
  if (!ownerId) return NextResponse.json({ skipped: true, reason: 'Arbre introuvable.' });

  // Rejoindre son propre arbre → aucune notif.
  if (ownerId === user.id) return NextResponse.json({ skipped: true, reason: 'self-join' });

  // --- Nom du membre (affichage), RLS-safe via get_public_profiles ---
  const { data: profiles } = await supabase.rpc('get_public_profiles', { ids: [user.id] });
  const member = ((profiles as Array<{ id: string; display_name: string | null; email: string | null }> | null) ?? [])
    .find(p => p.id === user.id);
  const memberName = member?.display_name?.trim() || member?.email?.trim() || 'Un nouveau membre';

  // --- Tokens push du propriétaire + sa locale (RPC SECURITY DEFINER scopée) ---
  const { data: targets, error: tErr } = await supabase
    .rpc('get_tree_owner_push_targets', { p_tree_id: treeId });
  if (tErr) return NextResponse.json({ skipped: true, reason: 'RPC indisponible (migration ?).' });
  const rows = (targets as Array<{ user_id: string; token: string; locale: string | null }> | null) ?? [];
  if (rows.length === 0) return NextResponse.json({ skipped: true, reason: 'Propriétaire sans token.' });

  const locale: PushLocale = rows[0]?.locale === 'en' ? 'en' : 'fr';
  const { title, body: pushBody } = memberJoinedPushMessage(memberName, treeName, locale);
  const messages: ExpoPushMessage[] = rows.map(r => ({
    to: r.token, title, body: pushBody, sound: 'default',
    data: { treeId, kind: 'member_joined' },
  }));

  // --- Envoi via le cœur mutualisé (chunks de 100 + tokens morts) ---
  // NB : la purge des DeviceNotRegistered est laissée au cron anniversaires
  // (service_role, quotidien) — ici l'appelant-membre n'a pas le droit RLS de
  // supprimer les tokens du propriétaire, et ce n'est pas le rôle de ce hook.
  const { sent, dead } = await sendExpoPush(messages);
  return NextResponse.json({ sent, deviceNotRegistered: dead.length });
}
