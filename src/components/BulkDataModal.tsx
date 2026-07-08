'use client';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Search, Check } from 'lucide-react';
import type { FamilyTree, Person } from '@/types';
import { getDisplayName } from '@/lib/treeUtils';
import { useOverlay } from '@/hooks/useOverlay';

/**
 * Édition EN MASSE des champs non normalisés (surnom / nom de jeune fille) de
 * l'arbre actif, directement dans l'UI — pour ne plus jamais passer par le SQL
 * Editor pour corriger des surnoms (ex. TEDA). Le propriétaire écrit sa propre
 * donnée via le store (anon key + RLS) ; la sync existante persiste.
 *
 * ⚠️ Effacer un champ envoie '' (chaîne vide PRÉSENTE), jamais undefined : sinon
 * preserveRemoteExtra (supabaseSync) ressusciterait l'ancienne valeur distante.
 * Générique (tout arbre), aucun ID en dur.
 */
interface Props {
  tree: FamilyTree;
  onUpdatePerson: (id: string, updates: Partial<Person>) => void;
  onClose: () => void;
  onToast?: (msg: string, type?: string) => void;
}

type Field = 'nickName' | 'maidenName';

export default function BulkDataModal({ tree, onUpdatePerson, onClose, onToast }: Props) {
  const t = useTranslations('bulkData');
  const ref = useOverlay<HTMLDivElement>(onClose);
  const [query, setQuery] = useState('');
  // Brouillon local par personne : édition fluide, commit au blur si changé.
  const [drafts, setDrafts] = useState<Record<string, { nickName: string; maidenName: string }>>(() => {
    const d: Record<string, { nickName: string; maidenName: string }> = {};
    for (const p of tree.persons) d[p.id] = { nickName: p.nickName ?? '', maidenName: p.maidenName ?? '' };
    return d;
  });
  const [savedId, setSavedId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...tree.persons].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
    if (!q) return sorted;
    return sorted.filter(p => {
      const dr = drafts[p.id];
      return getDisplayName(p).toLowerCase().includes(q)
        || (dr?.nickName ?? '').toLowerCase().includes(q)
        || (dr?.maidenName ?? '').toLowerCase().includes(q);
    });
  }, [tree.persons, query, drafts]);

  const setDraft = (id: string, field: Field, value: string) =>
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  // Commit au blur : seulement si la valeur a réellement changé. On envoie la
  // valeur TELLE QUELLE (y compris '') pour que l'effacement « colle ».
  const commit = (p: Person, field: Field) => {
    const next = (drafts[p.id]?.[field] ?? '');
    const current = (p[field] ?? '') as string;
    if (next === current) return;
    onUpdatePerson(p.id, { [field]: next } as Partial<Person>);
    setSavedId(p.id);
    onToast?.(t('saved', { name: getDisplayName(p) || t('unnamed') }), 'success');
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="bulkdata-title"
        className="card" style={{ width: 'min(680px, 96vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', padding: '20px 20px 12px' }}>
          <div>
            <h2 id="bulkdata-title" className="serif" style={{ fontSize: '20px', margin: 0 }}>{t('title')}</h2>
            <p className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('subtitle', { tree: tree.name, count: tree.persons.length })}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label={t('close')} style={{ padding: '6px' }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '0 20px 12px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} aria-hidden="true" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            <input className="input" value={query} onChange={e => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')} aria-label={t('searchPlaceholder')} style={{ paddingLeft: '30px' }} />
          </div>
        </div>

        {/* Column headers */}
        <div className="mono" aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', padding: '0 20px 6px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-light)' }}>
          <span>{t('colPerson')}</span><span>{t('colNick')}</span><span>{t('colMaiden')}</span>
        </div>

        {/* Rows */}
        <div style={{ overflowY: 'auto', padding: '0 20px 20px', borderTop: 'var(--bw) solid var(--border-strong)' }}>
          {rows.length === 0 && (
            <p style={{ color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>{t('empty')}</p>
          )}
          {rows.map(p => {
            const dr = drafts[p.id] ?? { nickName: '', maidenName: '' };
            const name = getDisplayName(p) || t('unnamed');
            return (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', alignItems: 'center', padding: '8px 0', borderBottom: 'var(--bw) solid var(--border-strong)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                  <div className="mono" style={{ fontSize: '10px', color: 'var(--text-light)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {p.id}{savedId === p.id && <Check size={11} aria-hidden="true" style={{ color: 'var(--success)' }} />}
                  </div>
                </div>
                <input className="input" value={dr.nickName}
                  onChange={e => setDraft(p.id, 'nickName', e.target.value)}
                  onBlur={() => commit(p, 'nickName')}
                  aria-label={t('nickForPerson', { name })} placeholder={t('nickPlaceholder')} />
                <input className="input" value={dr.maidenName}
                  onChange={e => setDraft(p.id, 'maidenName', e.target.value)}
                  onBlur={() => commit(p, 'maidenName')}
                  aria-label={t('maidenForPerson', { name })} placeholder={t('maidenPlaceholder')} />
              </div>
            );
          })}
        </div>

        <div style={{ padding: '12px 20px', borderTop: 'var(--bw) solid var(--border-strong)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('hint')}</span>
          <button className="btn btn-primary btn-sm" onClick={onClose}>{t('done')}</button>
        </div>
      </div>
    </div>
  );
}
