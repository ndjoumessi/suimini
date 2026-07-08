/**
 * Real-time Supabase status poller for the mobile app (Statuspage.io public
 * API). Native fetch has no CORS restriction. Everything FAILS OPEN: any
 * network/parse error resolves to indicator 'none' so the app never blocks nor
 * shows a false alarm.
 *
 * Persistence is IN-MEMORY only (a module-level cache + 60s interval) — we do
 * NOT add MMKV keys for ephemeral status.
 *
 * NB: kept independent from the web hook (web ≠ mobile — no cross-imports).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type StatusIndicator = 'none' | 'minor' | 'major' | 'critical';

export interface SupabaseStatus {
  indicator: StatusIndicator;
  description: string;
  lastChecked: number | null;
}

const STATUS_URL = 'https://status.supabase.com/api/v2/status.json';
const TTL_MS = 55_000;
const POLL_MS = 60_000;

const FAIL_OPEN: SupabaseStatus = { indicator: 'none', description: '', lastChecked: null };

/** In-memory cache shared across mounts within a session (no MMKV). */
let memCache: { data: SupabaseStatus; ts: number } | null = null;

export function normalizeIndicator(v: unknown): StatusIndicator {
  return v === 'minor' || v === 'major' || v === 'critical' ? v : 'none';
}

export interface MobileBannerLevel {
  level: 'minor' | 'major' | 'critical';
  /** Palette token key resolved by the component (accent | warning | danger). */
  tone: 'accent' | 'warning' | 'danger';
  /** Louder levels get a bigger icon. */
  iconSize: number;
}

export function bannerLevel(indicator: StatusIndicator): MobileBannerLevel | null {
  switch (indicator) {
    case 'critical':
      return { level: 'critical', tone: 'danger', iconSize: 20 };
    case 'major':
      return { level: 'major', tone: 'warning', iconSize: 20 };
    case 'minor':
      return { level: 'minor', tone: 'accent', iconSize: 18 };
    default:
      return null;
  }
}

/** Stable dismissal key for the current indicator + description (new incident → new key). */
export function dismissKey(status: { indicator: StatusIndicator; description?: string }): string {
  let h = 5381;
  const s = status.description ?? '';
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${status.indicator}-${(h >>> 0).toString(36)}`;
}

async function fetchStatus(): Promise<SupabaseStatus> {
  try {
    const res = await fetch(STATUS_URL, { cache: 'no-store' });
    if (!res.ok) return { ...FAIL_OPEN, lastChecked: Date.now() };
    const json = (await res.json()) as { status?: { indicator?: string; description?: string } };
    return {
      indicator: normalizeIndicator(json?.status?.indicator),
      description: json?.status?.description ?? '',
      lastChecked: Date.now(),
    };
  } catch {
    return { ...FAIL_OPEN, lastChecked: Date.now() }; // FAIL OPEN
  }
}

export function useSupabaseStatus(): SupabaseStatus {
  const [status, setStatus] = useState<SupabaseStatus>(() => memCache?.data ?? FAIL_OPEN);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (memCache && Date.now() - memCache.ts < TTL_MS) {
      if (mounted.current) setStatus(memCache.data);
      return;
    }
    const next = await fetchStatus();
    memCache = { data: next, ts: Date.now() };
    if (mounted.current) setStatus(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    const id = setInterval(() => { void load(); }, POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [load]);

  return status;
}
