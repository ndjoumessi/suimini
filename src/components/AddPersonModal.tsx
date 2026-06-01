'use client';
import { Person } from '@/types';
import PersonForm from './PersonForm';

interface Props {
  onClose: () => void;
  onAdd: (person: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export default function AddPersonModal({ onClose, onAdd }: Props) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid var(--border)', marginBottom: '0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px' }}>
            <h2 className="serif" style={{ margin: 0, fontSize: '1.3rem' }}>➕ Nouvelle personne</h2>
            <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
          </div>
        </div>
        <div style={{ padding: '20px 24px 24px', maxHeight: '80vh', overflowY: 'auto' }}>
          <PersonForm
            onSave={(data) => {
              onAdd({
                firstName: '',
                lastName: '',
                gender: 'unknown',
                isAlive: true,
                ...data,
              } as Omit<Person, 'id' | 'createdAt' | 'updatedAt'>);
            }}
            onCancel={onClose}
            submitLabel="Créer la personne"
          />
        </div>
      </div>
    </div>
  );
}
