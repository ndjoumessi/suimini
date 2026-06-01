'use client';
import { useOverlay } from '@/hooks/useOverlay';
import { useState } from 'react';
import { FamilyTree } from '@/types';

interface Props {
  trees: FamilyTree[];
  activeTreeId: string | null;
  shared?: Record<string, { sharedByName?: string }>;
  onSelect: (id: string) => void;
  onCreate: (name: string, description?: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, meta: { name?: string; description?: string }) => void;
  onDuplicate: (id: string, newName: string) => void;
  onClose: () => void;
}

export default function TreeSelectorModal({ trees, activeTreeId, shared = {}, onSelect, onCreate, onDelete, onRename, onDuplicate, onClose }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [dupId, setDupId] = useState<string | null>(null);
  const [dupName, setDupName] = useState('');

  function startEdit(tree: FamilyTree) {
    setEditId(tree.id); setEditName(tree.name); setEditDesc(tree.description || '');
    setDupId(null); setDeleteConfirm(null);
  }
  function startDup(tree: FamilyTree) {
    setDupId(tree.id); setDupName(`${tree.name} (copie)`);
    setEditId(null); setDeleteConfirm(null);
  }

  const overlayRef = useOverlay(onClose);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={overlayRef} tabIndex={-1} className="modal" style={{ maxWidth: '520px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="serif" style={{ margin: 0 }}>🌳 Mes arbres</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>

        <div style={{ padding: '16px 24px', maxHeight: '60vh', overflowY: 'auto' }}>
          {trees.length === 0 && !showCreate && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
              Aucun arbre. Créez-en un ci-dessous.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {trees.map(tree => (
              <div
                key={tree.id}
                style={{
                  padding: '12px', border: `2px solid ${activeTreeId === tree.id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)', background: activeTreeId === tree.id ? 'var(--accent-light)' : 'var(--bg-card)',
                  transition: 'all 0.15s',
                }}
              >
                {editId === tree.id ? (
                  /* Edit / rename form */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="animate-fade-in">
                    <input autoFocus value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nom de l'arbre" className="input" />
                    <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description (optionnel)" className="input" />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => { if (editName.trim()) { onRename(tree.id, { name: editName.trim(), description: editDesc.trim() }); setEditId(null); } }}
                        className="btn btn-primary btn-sm" disabled={!editName.trim()}
                      >✓ Enregistrer</button>
                      <button onClick={() => setEditId(null)} className="btn btn-ghost btn-sm">Annuler</button>
                    </div>
                  </div>
                ) : dupId === tree.id ? (
                  /* Duplicate form */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="animate-fade-in">
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Dupliquer « {tree.name} » sous le nom :</div>
                    <input autoFocus value={dupName} onChange={e => setDupName(e.target.value)} placeholder="Nom de la copie" className="input" />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => { if (dupName.trim()) { onDuplicate(tree.id, dupName.trim()); setDupId(null); onClose(); } }}
                        className="btn btn-primary btn-sm" disabled={!dupName.trim()}
                      >📋 Dupliquer</button>
                      <button onClick={() => setDupId(null)} className="btn btn-ghost btn-sm">Annuler</button>
                    </div>
                  </div>
                ) : (
                  /* Normal row */
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={() => { onSelect(tree.id); onClose(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                    >
                      <span style={{ fontSize: '28px' }}>🌳</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '700', fontSize: '14px' }}>
                          {tree.name}
                          {activeTreeId === tree.id && (
                            <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase' }}>Actif</span>
                          )}
                          {shared[tree.id] && (
                            <span className="badge badge-accent" style={{ marginLeft: '8px', fontSize: '9px' }}>
                              🤝 Partagé par {shared[tree.id].sharedByName || 'un proche'}
                            </span>
                          )}
                        </div>
                        {tree.description && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{tree.description}</div>
                        )}
                        <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '2px' }}>
                          {tree.persons.length} personnes · {tree.relationships.length} relations
                        </div>
                      </div>
                    </button>
                    {deleteConfirm === tree.id ? (
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button onClick={() => { onDelete(tree.id); setDeleteConfirm(null); }} className="btn btn-danger btn-sm">Oui</button>
                        <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost btn-sm">Non</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                        <button onClick={() => startEdit(tree)} className="btn btn-ghost btn-sm" title="Renommer / modifier" style={{ color: 'var(--text-light)' }}>✏️</button>
                        <button onClick={() => startDup(tree)} className="btn btn-ghost btn-sm" title="Dupliquer" style={{ color: 'var(--text-light)' }}>📋</button>
                        {trees.length > 1 && (
                          <button onClick={() => setDeleteConfirm(tree.id)} className="btn btn-ghost btn-sm" title="Supprimer" style={{ color: 'var(--text-light)' }}>🗑</button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {showCreate ? (
            <div style={{ padding: '16px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)' }} className="animate-fade-in">
              <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Nouvel arbre</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nom de l'arbre (ex: Famille Martin)"
                  className="input"
                />
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Description (optionnel)"
                  className="input"
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      if (name.trim()) {
                        onCreate(name.trim(), description.trim() || undefined);
                        setName('');
                        setDescription('');
                        setShowCreate(false);
                        onClose();
                      }
                    }}
                    className="btn btn-primary btn-sm"
                    disabled={!name.trim()}
                  >
                    ✓ Créer
                  </button>
                  <button onClick={() => setShowCreate(false)} className="btn btn-ghost btn-sm">Annuler</button>
                </div>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCreate(true)} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
              ＋ Créer un nouvel arbre
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
