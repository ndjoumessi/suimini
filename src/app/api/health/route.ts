import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getDataLayerRule } from '@/lib/dataLayerConfig';

// Server route (Node) : diagnostic de configuration. Réservé aux admins.
// ⚠️ Ne renvoie JAMAIS la VALEUR d'un secret — uniquement sa PRÉSENCE (booléen).
export const runtime = 'nodejs';

interface Check { key: string; label: string; group: string; scope: 'app' | 'server'; optional?: boolean }

// Secrets vérifiables depuis le runtime de l'app (env public + serveur).
// Les secrets CI (SUPABASE_ACCESS_TOKEN, PROJECT_ID, CRON_SECRET) NE sont PAS
// visibles ici — ils vivent dans GitHub Actions, pas dans l'app (frontière RLS).
const CHECKS: Check[] = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'Supabase URL', group: 'supabase', scope: 'app' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', label: 'Supabase anon key', group: 'supabase', scope: 'app' },
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic (rapports IA)', group: 'ia', scope: 'server' },
  { key: 'RESEND_API_KEY', label: 'Resend (emails)', group: 'email', scope: 'server' },
  { key: 'RESEND_FROM', label: 'Resend expéditeur', group: 'email', scope: 'server', optional: true },
];

function listExpectedMigrations(): string[] {
  try {
    return readdirSync(join(process.cwd(), 'supabase', 'migrations'))
      .filter(f => /^\d{4}_.+\.sql$/.test(f))
      .map(f => f.replace(/\.sql$/, ''))
      .sort();
  } catch {
    return []; // fichiers non embarqués → liste vide (voir CI)
  }
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 500 });

  // AuthZ : admin uniquement (l'info de config n'est pas publique).
  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: { getAll() { return cookieStore.getAll(); }, setAll() { /* read-only */ } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs.' }, { status: 403 });
  }

  const checks = CHECKS.map(c => ({ ...c, present: !!process.env[c.key] }));
  const missingRequired = checks.filter(c => !c.optional && !c.present).map(c => c.key);
  // Défaut serveur runtime du transport DataClient (flip global Phase 0). Lu depuis
  // Edge Config ; `edgeConfigured` = false ⇒ FALLBACK 'direct' (pas encore provisionné).
  const rule = await getDataLayerRule();
  return NextResponse.json({
    ok: missingRequired.length === 0,
    checks,
    missingRequired,
    dataLayer: {
      edgeConfigured: !!process.env.EDGE_CONFIG,
      default: rule.default,
      apiPercent: rule.apiPercent,
      apiAllowlistCount: rule.apiAllowlist.length,
    },
    // Les migrations ATTENDUES (fichiers du repo). L'état « appliqué » vit dans
    // public.suimini_migrations, non lisible au runtime (RLS sans policy, par
    // conception) → vérifiable via la CI (.github/workflows/migrate.yml).
    migrations: listExpectedMigrations(),
  });
}
