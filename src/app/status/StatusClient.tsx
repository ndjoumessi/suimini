'use client';
/**
 * Public /status page — real-time Supabase health + incident history. Client
 * fetches the same Statuspage API as the banner (fail-open). Atelier styling,
 * i18n via the `status` namespace. a11y: <main id="main-content"> + h1 + lists.
 */
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, AlertTriangle, AlertOctagon, Wrench, Circle } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useSupabaseStatus, type StatusComponent, type StatusIncident } from '@/hooks/useSupabaseStatus';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Component names we surface prominently (in this order). Others follow. */
const KEY_COMPONENTS = ['Database', 'Auth', 'Storage', 'Realtime', 'Edge Functions'];

function componentTone(status: string): { color: string; ok: boolean } {
  switch (status) {
    case 'operational':
      return { color: 'var(--success)', ok: true };
    case 'degraded_performance':
    case 'under_maintenance':
      return { color: 'var(--warning)', ok: false };
    case 'partial_outage':
      return { color: 'var(--warning)', ok: false };
    case 'major_outage':
      return { color: 'var(--danger)', ok: false };
    default:
      return { color: 'var(--text-muted)', ok: false };
  }
}

function ComponentIcon({ status }: { status: string }) {
  const { color } = componentTone(status);
  const common = { size: 16, 'aria-hidden': true as const, style: { color, flexShrink: 0 } };
  if (status === 'operational') return <CheckCircle2 {...common} />;
  if (status === 'under_maintenance') return <Wrench {...common} />;
  if (status === 'major_outage') return <AlertOctagon {...common} />;
  if (status === 'degraded_performance' || status === 'partial_outage') return <AlertTriangle {...common} />;
  return <Circle {...common} />;
}

export default function StatusClient() {
  const t = useTranslations('status');
  const status = useSupabaseStatus({ detailed: true });

  const componentStatusLabel = (s: string): string => {
    const map: Record<string, string> = {
      operational: t('comp.operational'),
      degraded_performance: t('comp.degraded'),
      partial_outage: t('comp.partialOutage'),
      major_outage: t('comp.majorOutage'),
      under_maintenance: t('comp.maintenance'),
    };
    return map[s] ?? t('comp.unknown');
  };

  const leafComponents = useMemo(
    () => status.components.filter((c) => !c.group),
    [status.components],
  );

  // Key components first (in KEY_COMPONENTS order), then the rest alphabetically.
  const orderedComponents = useMemo(() => {
    const rank = (c: StatusComponent) => {
      const i = KEY_COMPONENTS.indexOf(c.name);
      return i === -1 ? KEY_COMPONENTS.length : i;
    };
    return [...leafComponents].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [leafComponents]);

  const now = Date.now();
  const currentIncidents = useMemo(
    () => status.incidents.filter((i) => i.status !== 'resolved' && i.status !== 'postmortem'),
    [status.incidents],
  );
  const pastIncidents = useMemo(
    () =>
      status.incidents.filter(
        (i) =>
          (i.status === 'resolved' || i.status === 'postmortem') &&
          i.resolved_at != null &&
          now - new Date(i.resolved_at).getTime() < THIRTY_DAYS_MS,
      ),
    [status.incidents, now],
  );

  const allOperational = status.indicator === 'none' && currentIncidents.length === 0;

  const lastCheckedLabel =
    status.lastChecked != null
      ? new Date(status.lastChecked).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      : '—';

  return (
    <main
      id="main-content"
      style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px', fontFamily: 'var(--font-body)', color: 'var(--text)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 48 }}>
        <a
          href="/"
          style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-mono)', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
        >
          <span aria-hidden="true">←</span> {t('back')}
        </a>
        <LanguageSwitcher />
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        {t('eyebrow')}
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, margin: '0 0 8px' }}>
        {t('title')}
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 32px', fontFamily: 'var(--font-mono)' }}>
        {t('lastChecked', { time: lastCheckedLabel })}
      </p>

      {/* Overall banner */}
      <div
        role="status"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 16px',
          marginBottom: 40,
          background: allOperational
            ? 'color-mix(in srgb, var(--success) 12%, var(--bg-card))'
            : 'color-mix(in srgb, var(--warning) 14%, var(--bg-card))',
          border: `var(--bw) solid ${allOperational ? 'var(--success)' : 'var(--warning)'}`,
        }}
      >
        {allOperational ? (
          <CheckCircle2 size={18} aria-hidden="true" style={{ color: 'var(--success)', flexShrink: 0 }} />
        ) : (
          <AlertTriangle size={18} aria-hidden="true" style={{ color: 'var(--warning)', flexShrink: 0 }} />
        )}
        <span style={{ fontSize: 14, fontWeight: 700 }}>
          {allOperational ? t('allOperational') : (status.description || t('incidentGeneric'))}
        </span>
      </div>

      {/* Current incidents */}
      {currentIncidents.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, borderBottom: '2px solid var(--ink)', paddingBottom: 8, marginBottom: 16 }}>
            {t('currentIncidents')}
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {currentIncidents.map((i) => (
              <IncidentItem key={i.id} incident={i} t={t} />
            ))}
          </ul>
        </section>
      )}

      {/* Component status */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, borderBottom: '2px solid var(--ink)', paddingBottom: 8, marginBottom: 16 }}>
          {t('components')}
        </h2>
        {orderedComponents.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('componentsUnavailable')}</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {orderedComponents.map((c) => {
              const tone = componentTone(c.status);
              return (
                <li
                  key={c.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: 'var(--bw) solid var(--border)' }}
                >
                  <ComponentIcon status={c.status} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--ink)' }}>{c.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: tone.color }}>
                    {componentStatusLabel(c.status)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Past incidents (30 days) */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, borderBottom: '2px solid var(--ink)', paddingBottom: 8, marginBottom: 16 }}>
          {t('pastIncidents')}
        </h2>
        {pastIncidents.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('noPastIncidents')}</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {pastIncidents.map((i) => (
              <IncidentItem key={i.id} incident={i} t={t} resolved />
            ))}
          </ul>
        )}
      </section>

      <p style={{ color: 'var(--text-light)', fontSize: 12, fontFamily: 'var(--font-mono)', marginTop: 8 }}>
        {t('source')}{' '}
        <a href="https://status.supabase.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
          status.supabase.com
        </a>
      </p>
    </main>
  );
}

function IncidentItem({
  incident,
  t,
  resolved,
}: {
  incident: StatusIncident;
  t: ReturnType<typeof useTranslations>;
  resolved?: boolean;
}) {
  const date = incident.resolved_at ?? incident.updated_at ?? incident.created_at;
  const dateLabel = date ? new Date(date).toLocaleDateString() : '';
  const impactColor =
    incident.impact === 'critical' || incident.impact === 'major'
      ? 'var(--danger)'
      : incident.impact === 'minor'
        ? 'var(--warning)'
        : 'var(--text-muted)';
  return (
    <li style={{ background: 'var(--bg-card)', border: 'var(--bw) solid var(--border-strong)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{incident.name}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: resolved ? 'var(--success)' : impactColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {resolved ? t('resolved') : incident.status}
        </span>
      </div>
      {dateLabel && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{dateLabel}</div>
      )}
      {incident.incident_updates && incident.incident_updates[0]?.body && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.6 }}>
          {incident.incident_updates[0].body}
        </p>
      )}
    </li>
  );
}
