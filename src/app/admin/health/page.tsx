'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { CheckCircle2, XCircle, MinusCircle, ShieldAlert, ArrowLeft, Activity, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Check { key: string; label: string; group: string; scope: 'app' | 'server'; optional?: boolean; present: boolean }
interface DataLayer { edgeConfigured: boolean; default: 'api' | 'direct'; apiPercent: number; apiAllowlistCount: number }
interface Health { ok: boolean; checks: Check[]; missingRequired: string[]; migrations: string[]; dataLayer?: DataLayer }

/**
 * /admin/health — diagnostic de configuration (présence des secrets + migrations
 * attendues). Réservé aux admins : la route /api/health impose l'AuthZ (403 sinon) ;
 * cette page ajoute une garde client. Aucune VALEUR de secret n'est exposée.
 */
export default function HealthPage() {
  const t = useTranslations('health');
  const { isAdmin, isLoading } = useAuth();
  const [data, setData] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Pas de setState synchrone au niveau supérieur de cette fonction (juste des
  // .then/.catch) : appelable telle quelle depuis l'effet de montage sans
  // déclencher la règle react-hooks/set-state-in-effect (setRefreshing reste
  // du ressort du seul gestionnaire de clic explicite, handleRefresh).
  const fetchHealth = useCallback(() => {
    return fetch('/api/health')
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setCheckedAt(new Date()); setError(null); })
      .catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    if (isLoading || !isAdmin) return;
    fetchHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isLoading]);

  function handleRefresh() {
    setRefreshing(true);
    fetchHealth().finally(() => setRefreshing(false));
  }

  if (isLoading) return null;

  if (!isAdmin) {
    return (
      <main id="main-content" style={{ maxWidth: '560px', margin: '0 auto', padding: '48px 20px', textAlign: 'center' }}>
        <ShieldAlert size={32} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
        <h1 className="serif" style={{ fontSize: '22px', marginTop: '12px' }}>{t('forbiddenTitle')}</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>{t('forbiddenBody')}</p>
        <Link href="/app" className="btn btn-secondary btn-sm" style={{ marginTop: '20px', gap: '6px' }}>
          <ArrowLeft size={14} aria-hidden="true" /> {t('backToApp')}
        </Link>
      </main>
    );
  }

  const groups = data ? [...new Set(data.checks.map(c => c.group))] : [];

  return (
    <main id="main-content" className="hp-root" style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 20px 56px' }}>
      <Link href="/app" className="btn btn-ghost btn-sm" style={{ gap: '6px', marginBottom: '16px' }}>
        <ArrowLeft size={14} aria-hidden="true" /> {t('backToApp')}
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ width: '40px', height: '40px', flexShrink: 0, background: 'var(--accent-light)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={20} aria-hidden="true" />
          </span>
          <div>
            <h1 className="serif" style={{ fontSize: '26px', margin: 0 }}>{t('title')}</h1>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '13px', maxWidth: '52ch' }}>{t('subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <button onClick={handleRefresh} disabled={refreshing} className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
            <RefreshCw size={14} aria-hidden="true" style={refreshing ? { animation: 'hp-spin 0.8s linear infinite' } : undefined} /> {t('refresh')}
          </button>
          {checkedAt && (
            <span className="mono" style={{ fontSize: '11px', color: 'var(--text-light)' }}>
              {t('lastChecked', { time: checkedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) })}
            </span>
          )}
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        {error && <p role="alert" className="card" style={{ padding: '14px', color: 'var(--danger)' }}>{error}</p>}

      {data && (
        <>
          {/* Bandeau global */}
          <div className="card" style={{ padding: '14px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', borderColor: data.ok ? 'var(--success)' : 'var(--warning)' }}>
            {data.ok
              ? <CheckCircle2 size={20} aria-hidden="true" style={{ color: 'var(--success)' }} />
              : <ShieldAlert size={20} aria-hidden="true" style={{ color: 'var(--warning)' }} />}
            <span style={{ fontWeight: 600 }}>{data.ok ? t('allGood') : t('missing', { count: data.missingRequired.length })}</span>
          </div>

          {/* Défaut serveur runtime du transport (flip global Phase 0) */}
          {data.dataLayer && (
            <section className="card" style={{ padding: '16px', marginBottom: '14px' }}>
              <h2 className="mono" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-text)', margin: '0 0 6px' }}>{t('dataLayerTitle')}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 12px' }}>{t('dataLayerHint')}</p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{t('dataLayerDefault')}</span>
                  <span className="mono" style={{ marginLeft: 'auto', fontWeight: 700, color: data.dataLayer.default === 'api' ? 'var(--accent-text)' : 'var(--text-muted)' }}>{data.dataLayer.default}</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{t('dataLayerPercent')}</span>
                  <span className="mono" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{data.dataLayer.apiPercent}%</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{t('dataLayerAllowlist')}</span>
                  <span className="mono" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{data.dataLayer.apiAllowlistCount}</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {data.dataLayer.edgeConfigured
                    ? <CheckCircle2 size={16} aria-hidden="true" style={{ color: 'var(--success)', flexShrink: 0 }} />
                    : <MinusCircle size={16} aria-hidden="true" style={{ color: 'var(--text-light)', flexShrink: 0 }} />}
                  <span>{t('dataLayerEdge')}</span>
                  <span className="mono" style={{ marginLeft: 'auto', fontSize: '12px', color: data.dataLayer.edgeConfigured ? 'var(--success)' : 'var(--text-light)' }}>
                    {data.dataLayer.edgeConfigured ? t('present') : t('dataLayerFallback')}
                  </span>
                </li>
              </ul>
            </section>
          )}

          {/* Secrets par groupe + migrations — grille 2 colonnes dès 720px pour moins de scroll */}
          <div className="hp-grid">
            {groups.map(g => (
              <section key={g} className="card" style={{ padding: '16px' }}>
                <h2 className="mono" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-text)', margin: '0 0 10px' }}>{t(`group_${g}`)}</h2>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.checks.filter(c => c.group === g).map(c => (
                    <li key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {c.present
                        ? <CheckCircle2 size={16} aria-hidden="true" style={{ color: 'var(--success)', flexShrink: 0 }} />
                        : c.optional
                          ? <MinusCircle size={16} aria-hidden="true" style={{ color: 'var(--text-light)', flexShrink: 0 }} />
                          : <XCircle size={16} aria-hidden="true" style={{ color: 'var(--danger)', flexShrink: 0 }} />}
                      <span>{c.label}</span>
                      <code className="mono" style={{ fontSize: '11px', color: 'var(--text-light)' }}>{c.key}</code>
                      {c.optional && <span className="mono" style={{ fontSize: '10px', color: 'var(--text-light)' }}>{t('optional')}</span>}
                      <span style={{ marginLeft: 'auto', fontSize: '12px', color: c.present ? 'var(--success)' : c.optional ? 'var(--text-light)' : 'var(--danger)' }}>
                        {c.present ? t('present') : t('absent')}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {/* Migrations */}
            <section className="card" style={{ padding: '16px' }}>
              <h2 className="mono" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-text)', margin: '0 0 6px' }}>{t('migrationsTitle')}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 10px' }}>{t('migrationsHint')}</p>
              {data.migrations.length === 0
                ? <p style={{ color: 'var(--text-light)' }}>{t('migrationsNone')}</p>
                : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
                    {data.migrations.map(m => (
                      <li key={m} className="mono" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 size={13} aria-hidden="true" style={{ color: 'var(--text-light)' }} /> {m}
                      </li>
                    ))}
                  </ul>
                )}
            </section>
          </div>
        </>
      )}
      </div>

      <style>{`
        .hp-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @keyframes hp-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (min-width: 720px) {
          .hp-grid { grid-template-columns: 1fr 1fr; align-items: start; }
        }
      `}</style>
    </main>
  );
}
