'use client';
import { useState, useMemo } from 'react';
import { BookOpen, Plus, Pencil, Trash2, Check } from 'lucide-react';
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
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<DraftForm>(emptyDraft());
  const [filterPersonId, setFilterPersonId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const personName = (id: string) => {
    const p = tree.persons.find(pp => pp.id === id);
    return p ? getDisplayName(p) : 'Inconnu';
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
        <h2 className="serif" style={{ margin: 0, fontSize: '1.1rem', flex: 1, minWidth: '120px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} aria-hidden="true" />
          Journal familial
        </h2>
        <select value={filterPersonId} onChange={e => setFilterPersonId(e.target.value)} className="input" style={{ width: 'auto' }}>
          <option value="">Toutes les personnes</option>
          {tree.persons.map(p => <option key={p.id} value={p.id}>{getDisplayName(p)}</option>)}
        </select>
        <button onClick={startAdd} className="btn btn-primary btn-sm" style={{ gap: '6px' }}><Plus size={14} aria-hidden="true" /> Nouvelle entrée</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', maxWidth: '760px', width: '100%', margin: '0 auto' }}>
        {/* Add form */}
        {editingId === 'new' && (
          <div style={{ marginBottom: '20px' }}>
            <EntryEditor tree={tree} draft={draft} setDraft={setDraft} toggleMention={toggleMention} onSave={save} onCancel={cancel} title="Nouvelle entrée" />
          </div>
        )}

        {entries.length === 0 && editingId !== 'new' ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', maxWidth: '420px', margin: '0 auto' }}>
            <BookOpen size={48} strokeWidth={1.25} style={{ color: 'var(--text-light)', marginBottom: '12px' }} aria-hidden="true" />
            <h3 style={{ margin: '0 0 6px' }}>Le journal est vide</h3>
            <p style={{ color: 'var(--text-muted)' }}>{filterPersonId ? 'Aucune entrée ne mentionne cette personne.' : 'Consignez les moments, anecdotes et souvenirs de la famille.'}</p>
            {!filterPersonId && <button onClick={startAdd} className="btn btn-primary" style={{ marginTop: '12px', gap: '6px' }}><Plus size={16} aria-hidden="true" /> Première entrée</button>}
          </div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: '20px' }}>
            {/* Timeline rail */}
            <div style={{ position: 'absolute', left: '5px', top: '6px', bottom: '6px', width: '2px', background: 'var(--border)' }} />
            {entries.map(entry => (
              <div key={entry.id} style={{ position: 'relative', marginBottom: '18px' }}>
                <div style={{ position: 'absolute', left: '-19px', top: '6px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg-card)' }} />

                {editingId === entry.id ? (
                  <EntryEditor tree={tree} draft={draft} setDraft={setDraft} toggleMention={toggleMention} onSave={save} onCancel={cancel} title="Modifier l'entrée" />
                ) : (
                  <div className="card" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="label" style={{ color: 'var(--accent)' }}>
                          {formatDate(entry.date) || '—'}
                        </div>
                        <h3 className="serif" style={{ margin: '2px 0 0', fontSize: '1.15rem' }}>{entry.title}</h3>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button onClick={() => startEdit(entry)} className="btn btn-ghost btn-icon btn-sm" aria-label="Modifier l'entrée" title="Modifier"><Pencil size={15} aria-hidden="true" /></button>
                        <button onClick={() => setConfirmDelete(entry.id)} className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} aria-label="Supprimer l'entrée" title="Supprimer"><Trash2 size={15} aria-hidden="true" /></button>
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
                          <button key={id} onClick={() => onSelectPerson(id)} className="badge badge-accent" style={{ border: 'none', cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }}>
                            @ {personName(id)}
                          </button>
                        ))}
                      </div>
                    )}

                    {confirmDelete === entry.id && (
                      <div style={{ marginTop: '12px', padding: '10px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                        <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text)' }}>Supprimer cette entrée ?</p>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => { onDelete(entry.id); setConfirmDelete(null); }} className="btn btn-danger btn-sm">Oui, supprimer</button>
                          <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost btn-sm">Annuler</button>
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
            {entries.length} entrée{entries.length !== 1 ? 's' : ''}{filterPersonId ? ` sur ${total}` : ''}
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
  return (
    <div className="card animate-fade-in" style={{ padding: '16px' }}>
      <h3 className="serif" style={{ margin: '0 0 12px', fontSize: '1.1rem' }}>{title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <input autoFocus value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} className="input" placeholder="Titre *" />
        <input type="date" value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} className="input" />
      </div>
      <textarea value={draft.content} onChange={e => setDraft(d => ({ ...d, content: e.target.value }))} className="input" rows={5} placeholder="Racontez ce moment… (les retours à la ligne sont conservés)" style={{ resize: 'vertical', marginBottom: '8px', width: '100%' }} />

      <div style={{ marginBottom: '8px' }}>
        <div className="label" style={{ marginBottom: '6px' }}>Personnes mentionnées</div>
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

      <textarea value={draft.photosText} onChange={e => setDraft(d => ({ ...d, photosText: e.target.value }))} className="input" rows={2} placeholder="URLs de photos (une par ligne, https://…)" style={{ resize: 'vertical', marginBottom: '10px', width: '100%' }} />

      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={onSave} className="btn btn-primary btn-sm" style={{ gap: '6px' }} disabled={!draft.title.trim()}><Check size={14} aria-hidden="true" /> Enregistrer</button>
        <button onClick={onCancel} className="btn btn-ghost btn-sm">Annuler</button>
      </div>
    </div>
  );
}
