// ============================================================================
// Edge Function Supabase — notifications push anniversaires & commémorations
//
// Déclenchée chaque matin par pg_cron (voir supabase/birthday-cron.sql).
// Pour chaque personne dont c'est l'anniversaire (vivante) ou la date de
// commémoration du décès aujourd'hui (UTC), envoie une push Expo à tous les
// utilisateurs ayant accès à l'arbre (propriétaire + membres) et ayant
// enregistré un Expo Push Token (table push_tokens, remplie par l'app mobile
// via POST /api/push/register).
//
// Déploiement (manuel, une fois) :
//   supabase functions deploy send-birthday-notifications --no-verify-jwt
//   supabase secrets set CRON_SECRET=<valeur aléatoire longue>
// (SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectés automatiquement.)
//
// Sécurité : la fonction exige `Authorization: Bearer ${CRON_SECRET}` — seul le
// job pg_cron (qui connaît le secret) peut la déclencher. La service_role ne
// sert qu'ICI, côté Supabase ; elle n'existe nulle part dans le code applicatif.
//
// NB dates : birth_date / death_date sont des colonnes TEXT ('YYYY-MM-DD',
// parfois partielles) → le filtrage mois-jour se fait en JS, pas en SQL.
// NB noms : certains arbres (TEDA) inversent prénom/nom → le message utilise
// le nom complet affichable, jamais first_name seul.
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_CHUNK = 100; // limite de l'API Expo par requête

interface PersonRow {
  id: string; tree_id: string;
  first_name: string | null; last_name: string | null;
  birth_date: string | null; death_date: string | null;
  is_alive: boolean | null;
}

function displayName(p: PersonRow): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || 'Un proche';
}

/** 'YYYY-MM-DD…' → 'MM-DD', ou null si la date est partielle/invalide. */
function monthDay(date: string | null): string | null {
  if (!date || date.length < 10) return null;
  const md = date.slice(5, 10);
  return /^\d{2}-\d{2}$/.test(md) ? md : null;
}
function yearOf(date: string): number | null {
  const y = parseInt(date.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

Deno.serve(async (req) => {
  // --- Garde cron ---
  const secret = Deno.env.get('CRON_SECRET');
  const auth = req.headers.get('authorization') ?? '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const now = new Date();
  const todayMD = `${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  const todayYear = now.getUTCFullYear();

  // --- 1. Personnes vivantes/défuntes dont c'est le jour (filtrage JS) ---
  const { data: persons, error: pErr } = await supabase
    .from('persons')
    .select('id, tree_id, first_name, last_name, birth_date, death_date, is_alive')
    .is('deleted_at', null)
    .or('birth_date.not.is.null,death_date.not.is.null');
  if (pErr) return new Response(JSON.stringify({ error: pErr.message }), { status: 500 });

  type Event = { person: PersonRow; kind: 'birthday' | 'memorial'; years: number };
  const events: Event[] = [];
  for (const p of (persons ?? []) as PersonRow[]) {
    if (p.is_alive !== false && p.birth_date && monthDay(p.birth_date) === todayMD) {
      const y = yearOf(p.birth_date);
      if (y != null && todayYear - y > 0) events.push({ person: p, kind: 'birthday', years: todayYear - y });
    }
    if (p.is_alive === false && p.death_date && monthDay(p.death_date) === todayMD) {
      const y = yearOf(p.death_date);
      if (y != null && todayYear - y > 0) events.push({ person: p, kind: 'memorial', years: todayYear - y });
    }
  }
  if (events.length === 0) return new Response(JSON.stringify({ sent: 0, events: 0 }), { status: 200 });

  // --- 2. Destinataires par arbre : propriétaire + membres acceptés ---
  const treeIds = [...new Set(events.map(e => e.person.tree_id))];
  const recipientsByTree = new Map<string, Set<string>>();
  const { data: trees } = await supabase.from('trees').select('id, owner_id').in('id', treeIds);
  for (const t of trees ?? []) {
    recipientsByTree.set(t.id, new Set(t.owner_id ? [t.owner_id] : []));
  }
  // tree_members est optionnelle (migration sharing) — best-effort.
  try {
    const { data: members } = await supabase
      .from('tree_members').select('tree_id, user_id, status').in('tree_id', treeIds);
    for (const m of members ?? []) {
      if (m.user_id && (m.status == null || m.status === 'accepted')) {
        recipientsByTree.get(m.tree_id)?.add(m.user_id);
      }
    }
  } catch { /* table absente → propriétaires seulement */ }

  // --- 3. Tokens Expo des destinataires ---
  const userIds = [...new Set([...recipientsByTree.values()].flatMap(s => [...s]))];
  if (userIds.length === 0) return new Response(JSON.stringify({ sent: 0, events: events.length }), { status: 200 });
  const { data: tokens, error: tErr } = await supabase
    .from('push_tokens').select('user_id, token').in('user_id', userIds);
  if (tErr) return new Response(JSON.stringify({ error: tErr.message }), { status: 500 });
  const tokensByUser = new Map<string, string[]>();
  for (const t of tokens ?? []) {
    if (!tokensByUser.has(t.user_id)) tokensByUser.set(t.user_id, []);
    tokensByUser.get(t.user_id)!.push(t.token);
  }

  // --- 4. Messages (FR par défaut — pas de locale par utilisateur en base) ---
  const messages: { to: string; title: string; body: string; sound: string; data: Record<string, string> }[] = [];
  for (const ev of events) {
    const name = displayName(ev.person);
    const title = ev.kind === 'birthday' ? '🎂 Anniversaire' : '🕯️ Commémoration';
    const body = ev.kind === 'birthday'
      ? `${name} fête ses ${ev.years} ans aujourd'hui !`
      : `En mémoire de ${name}, disparu·e il y a ${ev.years} an${ev.years > 1 ? 's' : ''}.`;
    const users = recipientsByTree.get(ev.person.tree_id) ?? new Set<string>();
    for (const uid of users) {
      for (const token of tokensByUser.get(uid) ?? []) {
        messages.push({ to: token, title, body, sound: 'default', data: { treeId: ev.person.tree_id, personId: ev.person.id, kind: ev.kind } });
      }
    }
  }

  // --- 5. Envoi Expo par paquets de 100 + purge des tokens morts ---
  let sent = 0;
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += EXPO_CHUNK) {
    const chunk = messages.slice(i, i + EXPO_CHUNK);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(chunk),
    });
    const json = await res.json().catch(() => ({}));
    const tickets: { status?: string; details?: { error?: string } }[] = json?.data ?? [];
    tickets.forEach((ticket, idx) => {
      if (ticket.status === 'ok') sent += 1;
      else if (ticket.details?.error === 'DeviceNotRegistered') dead.push(chunk[idx].to);
    });
  }
  // push_tokens n'est PAS couverte par la règle soft-delete (persons/relationships) :
  // un token expiré est un déchet technique, on le purge réellement.
  if (dead.length) await supabase.from('push_tokens').delete().in('token', dead);

  return new Response(
    JSON.stringify({ events: events.length, recipients: userIds.length, sent, purgedTokens: dead.length }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
});
