'use client';
import { useOverlay } from '@/hooks/useOverlay';
import { useState } from 'react';
import { Person, Relationship, RelationType, FamilyTree } from '@/types';
import { getDisplayName } from '@/lib/treeUtils';
import { Check, Plus, Link2, User } from 'lucide-react';
import PersonForm from './PersonForm';

interface Props {
  onClose: () => void;
  tree: FamilyTree;
  onAdd: (person: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>, relation?: { type: RelationType; personId: string }) => void;
}

const REL_OPTIONS: { value: RelationType; label: string; icon: string; desc: string }[] = [
  { value: 'spouse',  label: 'Conjoint(e)',   icon: '💒', desc: 'Mari, femme, partenaire' },
  { value: 'parent',  label: 'Parent de',     icon: '👴', desc: 'Est parent de quelqu\'un dans l\'arbre' },
  { value: 'child',   label: 'Enfant de',     icon: '👶', desc: 'Est l\'enfant de quelqu\'un dans l\'arbre' },
  { value: 'sibling', label: 'Frère / Sœur',  icon: '👫', desc: 'Fratrie' },
];

export default function AddPersonModal({ onClose, tree, onAdd }: Props) {
  const [step, setStep] = useState<'form' | 'relation'>('form');
  const [newPerson, setNewPerson] = useState<Omit<Person, 'id' | 'createdAt' | 'updatedAt'> | null>(null);
  const [relType, setRelType] = useState<RelationType | ''>('');
  const [relPersonId, setRelPersonId] = useState('');

  function handleFormSave(data: Partial<Person>) {
    const person = {
      firstName: '', lastName: '', gender: 'unknown' as const, isAlive: true,
      ...data,
    } as Omit<Person, 'id' | 'createdAt' | 'updatedAt'>;
    setNewPerson(person);
    // If tree has people, go to relation step
    if (tree.persons.length > 0) {
      setStep('relation');
    } else {
      onAdd(person);
    }
  }

  function handleFinish() {
    if (!newPerson) return;
    if (relType && relPersonId) {
      onAdd(newPerson, { type: relType, personId: relPersonId });
    } else {
      onAdd(newPerson);
    }
  }

  const overlayRef = useOverlay(onClose);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={overlayRef} tabIndex={-1} className="modal" style={{ maxWidth: '600px' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="serif" style={{ margin: '0 0 2px', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {step === 'form' ? <><Plus size={20} aria-hidden="true" /> Nouvelle personne</> : <><Link2 size={20} aria-hidden="true" /> Établir une relation</>}
            </h2>
            {/* Step indicator */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: step === 'form' ? 'var(--accent)' : 'var(--text-light)' }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: step === 'form' ? 'var(--accent)' : 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700' }}>
                  {step === 'relation' ? '✓' : '1'}
                </div>
                Informations
              </div>
              <div style={{ width: '24px', height: '1px', background: 'var(--border)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: step === 'relation' ? 'var(--accent)' : 'var(--text-light)' }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: step === 'relation' ? 'var(--accent)' : 'var(--border)', color: step === 'relation' ? 'white' : 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700' }}>2</div>
                Relation
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>

        <div style={{ padding: '20px 24px 24px', maxHeight: '78vh', overflowY: 'auto' }}>
          {step === 'form' && (
            <div className="animate-fade-in">
              <PersonForm
                onSave={handleFormSave}
                onCancel={onClose}
                submitLabel={tree.persons.length > 0 ? 'Suivant : Établir une relation →' : 'Créer la personne'}
              />
            </div>
          )}

          {step === 'relation' && newPerson && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Summary of created person */}
              <div style={{ padding: '12px', background: 'var(--accent-light)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ display: 'inline-flex', color: newPerson.gender === 'male' ? 'var(--male)' : newPerson.gender === 'female' ? 'var(--female)' : 'var(--accent)' }}><User size={24} aria-hidden="true" /></span>
                <div>
                  <div style={{ fontWeight: '700' }}>{newPerson.firstName} {newPerson.lastName}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {newPerson.occupation || ''}{newPerson.birthDate ? ` · né(e) ${new Date(newPerson.birthDate).getFullYear()}` : ''}
                  </div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--accent)' }}>✓ Créé(e)</span>
              </div>

              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '10px', color: 'var(--text)' }}>
                  Quelle est sa relation avec un membre existant ?
                </div>

                {/* Relation type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                  {REL_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setRelType(opt.value)}
                      style={{
                        padding: '10px 12px', border: `2px solid ${relType === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius)', background: relType === opt.value ? 'var(--accent-light)' : 'var(--bg-card)',
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontSize: '18px', marginBottom: '2px' }}>{opt.icon}</div>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: relType === opt.value ? 'var(--accent)' : 'var(--text)' }}>{opt.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Person selector */}
                {relType && (
                  <div className="animate-fade-in" style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
                      {relType === 'spouse' ? '💒 Conjoint(e) de...' :
                       relType === 'parent' ? '👴 Est parent de...' :
                       relType === 'child' ? '👶 Est enfant de...' : '👫 Frère/Sœur de...'}
                    </label>
                    <select value={relPersonId} onChange={e => setRelPersonId(e.target.value)} className="input">
                      <option value="">Choisir une personne dans l'arbre...</option>
                      {[...tree.persons]
                        .sort((a,b) => a.lastName.localeCompare(b.lastName))
                        .map(p => (
                          <option key={p.id} value={p.id}>
                            {getDisplayName(p)}{p.birthDate ? ` (${new Date(p.birthDate).getFullYear()})` : ''}
                          </option>
                        ))}
                    </select>
                    {relPersonId && (
                      <div style={{ marginTop: '8px', padding: '8px 12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <Check size={13} style={{ color: 'var(--success)', flexShrink: 0 }} aria-hidden="true" /> {newPerson.firstName} {newPerson.lastName}{' '}
                        <strong>
                          {relType === 'spouse' ? 'sera marié(e) à' :
                           relType === 'parent' ? 'sera parent de' :
                           relType === 'child' ? 'sera enfant de' : 'sera frère/sœur de'}
                        </strong>{' '}
                        {getDisplayName(tree.persons.find(p => p.id === relPersonId)!)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setStep('form')} className="btn btn-ghost btn-sm">
                  ← Retour
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => onAdd(newPerson)} className="btn btn-secondary btn-sm">
                    Créer sans relation
                  </button>
                  <button
                    onClick={handleFinish}
                    className="btn btn-primary"
                    disabled={!relType || !relPersonId}
                  >
                    ✓ Créer avec la relation
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
