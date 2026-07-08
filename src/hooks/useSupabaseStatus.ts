'use client';
/**
 * Real-time Supabase status poller (Statuspage.io public API).
 *
 * Statuspage sets permissive CORS so the client can fetch directly. Everything
 * here FAILS OPEN: any network/parse error resolves to indicator 'none' so the
 * app never blocks or shows a false alarm.
 *
 * - Polls every 60s, caches in sessionStorage (TTL 55s) to avoid refetching on
 *   remounts / navigations within a session.
 * - `detailed` (the /status page) additionally pulls incidents + components.
 *   The banner uses the light path (summary only).
 *
 * The pure helpers `normalizeIndicator`, `bannerLevel` and `dismissKey` are
 * exported for unit testing (see e2e/supabase-status.spec.ts).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type StatusIndicator = 'none' | 'minor' | 'major' | 'critical';

export interface StatusIncidentUpdate {
  id: string;
  status: string; // investigating | identified | monitoring | resolved
  body: string;
  created_at: string;
}

export interface StatusIncident {
  id: string;
  name: string;
  status: string; // investigating | identified | monitoring | resolved | postmortem
  impact: string; // none | minor | major | critical
  shortlink?: string;
  created_at: string;
  updated_at?: string | null;
  resolved_at?: string | null;
  incident_updates?: StatusIncidentUpdate[];
}

export interface StatusComponent {
  id: string;
  name: string;
  status: string; // operational | degraded_performance | partial_outage | major_outage | under_maintenance
  description?: string | null;
  group?: boolean;
  group_id?: string | null;
}

export interface SupabaseStatus {
  indicator: StatusIndicator;
  description: string;
  incidents: StatusIncident[];
  components: StatusComponent[];
  lastChecked: number | null;
}

const BASE = 'https://status.supabase.com/api/v2';
const STATUS_URL = `${BASE}/status.json`;
const INCIDENTS_URL = `${BASE}/incidents.json`;
const COMPONENTS_URL = `${BASE}/components.json`;

const CACHE_KEY = 'suimini_supabase_status';
const TTL_MS = 55_000;
const POLL_MS = 60_000;

/** Neutral fail-open state — never blocks render, never shows a banner. */
const FAIL_OPEN: SupabaseStatus = {
  indicator: 'none',
  description: '',
  incidents: [],
  components: [],
  lastChecked: null,
};

/** Coerce an arbitrary API value to a known indicator (unknown → 'none'). */
export function normalizeIndicator(v: unknown): StatusIndicator {
  return v === 'minor' || v === 'major' || v === 'critical' ? v : 'none';
}

export interface BannerStyle {
  level: 'minor' | 'major' | 'critical';
  /** ARIA live role — critical demands an assertive alert. */
  role: 'status' | 'alert';
  /** CSS var driving the tint, border and icon colour (Atelier tokens). */
  color: string;
  /** Background tint mix percentage over --bg-card. */
  tintPct: number;
  /** Larger icon for the louder levels. */
  iconSize: number;
}

/**
 * Map a status indicator to the banner's visual level. Returns null for 'none'
 * (→ the banner renders nothing). Pure — unit-tested.
 */
export function bannerLevel(indicator: StatusIndicator): BannerStyle | null {
  switch (indicator) {
    case 'critical':
      return { level: 'critical', role: 'alert', color: 'var(--danger)', tintPct: 16, iconSize: 16 };
    case 'major':
      return { level: 'major', role: 'status', color: 'var(--warning)', tintPct: 14, iconSize: 16 };
    case 'minor':
      return { level: 'minor', role: 'status', color: 'var(--accent)', tintPct: 12, iconSize: 14 };
    default:
      return null;
  }
}

/** Small stable string hash (djb2) — used to key a dismissal by description. */
function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * sessionStorage key for a dismissed banner. Stable for the SAME incident, and
 * distinct for a NEW one (so a fresh incident re-shows the banner). Prefers the
 * incident id; falls back to indicator + a hash of the description. Pure.
 */
export function dismissKey(
  status: { indicator: StatusIndicator; description?: string; incidents?: { id: string }[] },
): string {
  const incidentId = status.incidents?.[0]?.id;
  const suffix = incidentId ?? `${status.indicator}-${hashStr(status.description ?? '')}`;
  return `suimini_status_dismissed_${suffix}`;
}

function cacheKey(detailed: boolean): string {
  return detailed ? `${CACHE_KEY}_full` : CACHE_KEY;
}

function readCache(detailed: boolean): { data: SupabaseStatus; ts: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(cacheKey(detailed));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data?: SupabaseStatus; ts?: number };
    if (parsed && typeof parsed.ts === 'number' && parsed.data) {
      return { data: parsed.data, ts: parsed.ts };
    }
  } catch { /* ignore */ }
  return null;
}

function writeCache(detailed: boolean, data: SupabaseStatus) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(cacheKey(detailed), JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignore (quota / private mode) */ }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // FAIL OPEN
  }
}

export interface UseSupabaseStatusOptions {
  /** Also fetch incidents + components (the /status page). Default: summary only. */
  detailed?: boolean;
  /** Poll interval, ms. Default 60_000. */
  pollMs?: number;
}

/**
 * Poll Supabase's public status. SSR-safe (no fetch on the server) and never
 * throws. Returns the last known status; indicator 'none' until proven otherwise.
 */
export function useSupabaseStatus(options?: UseSupabaseStatusOptions): SupabaseStatus {
  const detailed = options?.detailed ?? false;
  const pollMs = options?.pollMs ?? POLL_MS;
  const [status, setStatus] = useState<SupabaseStatus>(() => readCache(detailed)?.data ?? FAIL_OPEN);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const cached = readCache(detailed);
    if (cached && Date.now() - cached.ts < TTL_MS) {
      if (mounted.current) setStatus(cached.data);
      return;
    }
    const summary = await fetchJson<{ status?: { indicator?: string; description?: string } }>(STATUS_URL);
    const indicator = normalizeIndicator(summary?.status?.indicator);
    const description = summary?.status?.description ?? '';

    let incidents: StatusIncident[] = [];
    let components: StatusComponent[] = [];
    if (detailed) {
      const [inc, comp] = await Promise.all([
        fetchJson<{ incidents?: StatusIncident[] }>(INCIDENTS_URL),
        fetchJson<{ components?: StatusComponent[] }>(COMPONENTS_URL),
      ]);
      incidents = inc?.incidents ?? [];
      components = comp?.components ?? [];
    }

    const next: SupabaseStatus = { indicator, description, incidents, components, lastChecked: Date.now() };
    writeCache(detailed, next);
    if (mounted.current) setStatus(next);
  }, [detailed]);

  useEffect(() => {
    mounted.current = true;
    void load();
    const id = window.setInterval(() => { void load(); }, pollMs);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
    };
  }, [load, pollMs]);

  return status;
}
