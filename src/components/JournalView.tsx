'use client';
import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, Plus, Pencil, Trash2, Check } from 'lucide-react';
import { EmptyState } from './ui/EmptyState';
import { FamilyTree, JournalEntry } from '@/types';
import { getDisplayName, formatDate, safeHttpUrl } from '@/lib/treeUtils';

interface Props {
  tree: FamilyTree;
  onSelectPerson: (id: string) => void;
  onAdd: (entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdate: (id: string, updates: Partial<JournalEntry>) => void;
  onDelete: (id: string) => void;
}

interface DraftForm {
  title: string;
  date: string;
  content: string;
  mentionedPersonIds: string[];
  photosText: string;
}

const emptyDraft = (): DraftForm => ({ title: '', date: '', content: '', mentionedPersonIds: [], photosText: '' });

export default function JournalView({ tree, onSelectPerson, onAdd, onUpdate, onDelete }: Props) {
  const t = useTranslations('journal');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<DraftForm>(emptyDraft());
  const [filterPersonId, setFilterPersonId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const personName = (id: string) => {
    const p = tree.persons.find(pp => pp.id === id);
    return p ? getDisplayName(p) : t('unknownPerson');
  };

  const entries = useMemo(() => {
    const list = [...(tree.journal || [])];
    const filtered = filterPersonId
      ? list.filter(e => e.mentionedPersonIds?.includes(filterPersonId))
      : list;
    return filtered.sort((a, b) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt));
  }, [tree.journal, filterPersonId]);

  function startAdd() {
    setDraft({ ...emptyDraft(), date: new Date().toISOString().slice(0, 10) });
    setEditingId('new');
  }
  function startEdit(entry: JournalEntry) {
    setDraft({
      title: entry.title,
      date: entry.date || '',
      content: entry.content,
      mentionedPersonIds: entry.mentionedPersonIds || [],
      photosText: (entry.photos || []).join('\n'),
    });
    setEditingId(entry.id);
  }
  function cancel() { setEditingId(null); setDraft(emptyDraft()); }

  function toDraftPayload() {
    const photos = draft.photosText
      .split('\n')
      .map(s => safeHttpUrl(s))
      .filter((u): u is string => !!u);
    return {
      title: draft.title.trim(),
      date: draft.date || new Date().toISOString().slice(0, 10),
      content: draft.content.trim(),
      mentionedPersonIds: draft.mentionedPersonIds.length ? draft.mentionedPersonIds : undefined,
      photos: photos.length ? photos : undefined,
    };
  }
  function save() {
    if (!draft.title.trim()) return;
    const payload = toDraftPayload();
    if (editingId === 'new') onAdd(payload);
    else if (editingId) onUpdate(editingId, payload);
    cancel();
  }

  function toggleMention(id: string) {
    setDraft(d => ({
      ...d,
      mentionedPersonIds: d.mentionedPersonIds.includes(id)
        ? d.mentionedPersonIds.filter(x => x !== id)
        : [...d.mentionedPersonIds, id],
    }));
  }

  const total = tree.journal?.length || 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '120px' }} />{/* title lives in ContentHeader (no double header) */}
        <select value={filterPersonId} onChange={e => setFilterPersonId(e.target.value)} className="input" style={{ width: 'auto' }}>
          <option value="">{t('allPersons')}</option>
          {tree.persons.map(p => <option key={p.id} value={p.id}>{getDisplayName(p)}</option>)}
        </select>
        <button onClick={startAdd} className="btn btn-primary btn-sm" style={{ gap: '6px' }}><Plus size={14} aria-hidden="true" /> {t('newEntry')}</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', maxWidth: '760px', width: '100%', margin: '0 auto' }}>
        {/* Add form */}
        {editingId === 'new' && (
          <div style={{ marginBottom: '20px' }}>
            <EntryEditor tree={tree} draft={draft} setDraft={setDraft} toggleMention={toggleMention} onSave={save} onCancel={cancel} title={t('newEntry')} />
          </div>
        )}

        {entries.length === 0 && editingId !== 'new' ? (
          <EmptyState
            icon={BookOpen}
            title={t('emptyTitle')}
            description={filterPersonId ? t('emptyFiltered') : t('emptyDescription')}
            action={!filterPersonId ? { label: t('firstEntry'), onClick: startAdd } : undefined}
          />
        ) : (
          <div style={{ position: 'relative' }}>
            {entries.map(entry => (
              <div key={entry.id} style={{ position: 'relative', marginBottom: '14px' }}>
                {editingId === entry.id ? (
                  <EntryEditor tree={tree} draft={draft} setDraft={setDraft} toggleMention={toggleMention} onSave={save} onCancel={cancel} title={t('editEntry')} />
                ) : (
                  <div className="card" style={{ padding: '14px 16px 14px 18px', borderLeft: '3px solid var(--accent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="label" style={{ color: 'var(--accent-text)', opacity: 0.8 }}>
                          {formatDate(entry.date) || '—'}
                        </div>
                        <h3 className="serif" style={{ margin: '2px 0 0', fontSize: '1.15rem' }}>{entry.title}</h3>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button onClick={() => startEdit(entry)} className="btn btn-ghost btn-icon btn-sm" aria-label={t('editEntry')} title={t('edit')}><Pencil size={15} aria-hidden="true" /></button>
                        <button onClick={() => setConfirmDelete(entry.id)} className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} aria-label={t('deleteEntry')} title={t('delete')}><Trash2 size={15} aria-hidden="true" /></button>
                      </div>
                    </div>

                    {entry.content && (
                      <p style={{ margin: '10px 0 0', fontSize: '14px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{entry.content}</p>
                    )}

                    {entry.photos && entry.photos.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                        {entry.photos.map((url, i) => (
                          <img key={i} src={url} alt="" style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />
                        ))}
                      </div>
                    )}

                    {entry.mentionedPersonIds && entry.mentionedPersonIds.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
                        {entry.mentionedPersonIds.map(id => (
                          <button key={id} onClick={() => onSelectPerson(id)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', background: 'var(--bg-card)', color: 'var(--accent-text)', border: '1px solid var(--border)', padding: '3px 9px', fontFamily: 'var(--font-mono)', fontSize: '11px', transition: 'border-color var(--t-fast), background var(--t-fast)' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-light)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)'; }}>
                            @{personName(id)}
                          </button>
                        ))}
                      </div>
                    )}

                    {confirmDelete === entry.id && (
                      <div style={{ marginTop: '12px', padding: '10px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                        <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text)' }}>{t('confirmDelete')}</p>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => { onDelete(entry.id); setConfirmDelete(null); }} className="btn btn-danger btn-sm">{t('confirmDeleteYes')}</button>
                          <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost btn-sm">{t('cancel')}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {total > 0 && (
          <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-light)', marginTop: '8px' }}>
            {filterPersonId
              ? t('countFiltered', { count: entries.length, total })
              : t('count', { count: entries.length })}
          </div>
        )}
      </div>
    </div>
  );
}

function EntryEditor({ tree, draft, setDraft, toggleMention, onSave, onCancel, title }: {
  tree: FamilyTree;
  draft: DraftForm;
  setDraft: React.Dispatch<React.SetStateAction<DraftForm>>;
  toggleMention: (id: string) => void;
  onSave: () => void;
  onCancel: () => void;
  title: string;
}) {
  const t = useTranslations('journal');
  return (
    <div className="card animate-fade-in" style={{ padding: '16px' }}>
      <h3 className="serif" style={{ margin: '0 0 12px', fontSize: '1.1rem' }}>{title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <input autoFocus value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} className="input" placeholder={t('titlePlaceholder')} />
        <input type="date" value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} className="input" />
      </div>
      <textarea value={draft.content} onChange={e => setDraft(d => ({ ...d, content: e.target.value }))} className="input" rows={5} placeholder={t('contentPlaceholder')} style={{ resize: 'vertical', marginBottom: '8px', width: '100%' }} />

      <div style={{ marginBottom: '8px' }}>
        <div className="label" style={{ marginBottom: '6px' }}>{t('mentionedPersons')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '110px', overflowY: 'auto' }}>
          {tree.persons.map(p => {
            const on = draft.mentionedPersonIds.includes(p.id);
            return (
              <button key={p.id} type="button" onClick={() => toggleMention(p.id)}
                className={`badge ${on ? 'badge-accent' : ''}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer', background: on ? 'var(--accent-light)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-muted)' }}>
                {on && <Check size={12} aria-hidden="true" />}{getDisplayName(p)}
              </button>
            );
          })}
        </div>
      </div>

      <textarea value={draft.photosText} onChange={e => setDraft(d => ({ ...d, photosText: e.target.value }))} className="input" rows={2} placeholder={t('photosPlaceholder')} style={{ resize: 'vertical', marginBottom: '10px', width: '100%' }} />

      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={onSave} className="btn btn-primary btn-sm" style={{ gap: '6px' }} disabled={!draft.title.trim()}><Check size={14} aria-hidden="true" /> {t('save')}</button>
        <button onClick={onCancel} className="btn btn-ghost btn-sm">{t('cancel')}</button>
      </div>
    </div>
  );
}
