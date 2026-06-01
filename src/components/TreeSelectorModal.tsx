'use client';
import { useState } from 'react';
import { FamilyTree } from '@/types';

interface Props {
  trees: FamilyTree[];
  activeTreeId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string, description?: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function TreeSelectorModal({ trees, activeTreeId, onSelect, onCreate, onDelete, onClose }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '500px' }}>
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
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px', border: `2px solid ${activeTreeId === tree.id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)', background: activeTreeId === tree.id ? 'var(--accent-light)' : 'var(--bg-card)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onClick={() => { onSelect(tree.id); onClose(); }}
                onMouseEnter={e => { if (activeTreeId !== tree.id) e.currentTarget.style.borderColor = 'var(--text-light)'; }}
                onMouseLeave={e => { if (activeTreeId !== tree.id) e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <span style={{ fontSize: '28px' }}>🌳</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '14px' }}>
                    {tree.name}
                    {activeTreeId === tree.id && (
                      <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase' }}>Actif</span>
                    )}
                  </div>
                  {tree.description && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{tree.description}</div>
                  )}
                  <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '2px' }}>
                    {tree.persons.length} personnes · {tree.relationships.length} relations
                  </div>
                </div>
                {trees.length > 1 && deleteConfirm !== tree.id && (
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteConfirm(tree.id); }}
                    className="btn btn-ghost btn-sm"
                    title="Supprimer"
                    style={{ color: 'var(--text-light)' }}
                  >
                    🗑
                  </button>
                )}
                {deleteConfirm === tree.id && (
                  <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => { onDelete(tree.id); setDeleteConfirm(null); }} className="btn btn-danger btn-sm">Oui</button>
                    <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost btn-sm">Non</button>
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
