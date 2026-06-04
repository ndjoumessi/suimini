'use client';
import { useState, useRef } from 'react';
import { AlertCircle, FolderOpen, Plus, X } from 'lucide-react';
import { Person, Gender } from '@/types';

interface Props {
  initial?: Partial<Person>;
  onSave: (data: Partial<Person>) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

export default function PersonForm({ initial, onSave, onCancel, submitLabel = 'Enregistrer' }: Props) {
  const [form, setForm] = useState<Partial<Person>>({
    firstName: '', lastName: '', gender: 'unknown', isAlive: true,
    ...initial
  });
  const [cfEntries, setCfEntries] = useState<{ key: string; value: string }[]>(
    () => Object.entries(initial?.customFields || {}).map(([key, value]) => ({ key, value }))
  );
  const [photoError, setPhotoError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (field: keyof Person, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }));

  // --- Photo upload (→ base64 data URL) ---
  const handlePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    if (!file.type.startsWith('image/')) { setPhotoError('Le fichier doit être une image.'); return; }
    if (file.size > 2 * 1024 * 1024) { setPhotoError("Image trop volumineuse (max 2 Mo)."); return; }
    const reader = new FileReader();
    reader.onload = ev => set('profilePhoto', ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // --- Custom fields ---
  const addCf = () => setCfEntries(e => [...e, { key: '', value: '' }]);
  const updateCf = (i: number, field: 'key' | 'value', val: string) =>
    setCfEntries(e => e.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  const removeCf = (i: number) => setCfEntries(e => e.filter((_, idx) => idx !== i));

  // --- DNA / ethnic origins ---
  const dna = form.dnaOrigins || [];
  const dnaTotal = dna.reduce((s, d) => s + (Number(d.percent) || 0), 0);
  const dnaInvalid = dna.length > 0 && Math.round(dnaTotal) !== 100;
  const setDna = (next: { region: string; percent: number }[]) =>
    set('dnaOrigins', next.length ? next : undefined);
  const addDna = () => { if (dna.length < 8) setDna([...dna, { region: '', percent: 0 }]); };
  const updateDna = (i: number, field: 'region' | 'percent', value: string) =>
    setDna(dna.map((d, idx) => idx === i
      ? { ...d, [field]: field === 'percent' ? Math.max(0, Math.min(100, Number(value) || 0)) : value }
      : d));
  const removeDna = (i: number) => setDna(dna.filter((_, idx) => idx !== i));

  // --- Validation ---
  const dateInvalid = !!(!form.isAlive && form.birthDate && form.deathDate && form.deathDate < form.birthDate);
  const nameMissing = !form.firstName?.trim() || !form.lastName?.trim();
  const blocked = nameMissing || dnaInvalid || dateInvalid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked) return;
    const cleanDna = dna.filter(d => d.region.trim());
    const cf = cfEntries.filter(c => c.key.trim()).reduce<Record<string, string>>((acc, c) => { acc[c.key.trim()] = c.value; return acc; }, {});
    onSave({
      ...form,
      dnaOrigins: cleanDna.length ? cleanDna : undefined,
      customFields: Object.keys(cf).length ? cf : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <label style={labelStyle}>
          Prénom *
          <input
            value={form.firstName || ''}
            onChange={e => set('firstName', e.target.value)}
            className="input" placeholder="Ex: Marie" required
          />
        </label>
        <label style={labelStyle}>
          Nom *
          <input
            value={form.lastName || ''}
            onChange={e => set('lastName', e.target.value)}
            className="input" placeholder="Ex: Dupont" required
          />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <label style={labelStyle}>
          Nom de jeune fille
          <input
            value={form.maidenName || ''}
            onChange={e => set('maidenName', e.target.value)}
            className="input" placeholder="Nom de naissance"
          />
        </label>
        <label style={labelStyle}>
          Surnom
          <input
            value={form.nickName || ''}
            onChange={e => set('nickName', e.target.value)}
            className="input" placeholder="Diminutif, surnom..."
          />
        </label>
      </div>

      <label style={labelStyle}>
        Sexe
        <select value={form.gender} onChange={e => set('gender', e.target.value as Gender)} className="input">
          <option value="male">♂ Homme</option>
          <option value="female">♀ Femme</option>
          <option value="other">⚧ Autre</option>
          <option value="unknown">Inconnu</option>
        </select>
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <label style={labelStyle}>
          Date de naissance
          <input
            type="date"
            value={form.birthDate || ''}
            onChange={e => set('birthDate', e.target.value || undefined)}
            className="input"
          />
        </label>
        <label style={labelStyle}>
          Lieu de naissance
          <input
            value={form.birthPlace?.city || ''}
            onChange={e => set('birthPlace', e.target.value ? { ...(form.birthPlace || {}), city: e.target.value } : undefined)}
            className="input" placeholder="Ville"
          />
        </label>
      </div>

      <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
        <input
          type="checkbox"
          checked={form.isAlive}
          onChange={e => set('isAlive', e.target.checked)}
          style={{ width: 'auto', cursor: 'pointer' }}
        />
        <span style={{ fontSize: '14px' }}>Encore en vie</span>
      </label>

      {!form.isAlive && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <label style={labelStyle}>
            Date de décès
            <input
              type="date"
              value={form.deathDate || ''}
              onChange={e => set('deathDate', e.target.value || undefined)}
              className="input"
            />
          </label>
          <label style={labelStyle}>
            Lieu de décès
            <input
              value={form.deathPlace?.city || ''}
              onChange={e => set('deathPlace', e.target.value ? { ...(form.deathPlace || {}), city: e.target.value } : undefined)}
              className="input" placeholder="Ville"
            />
          </label>
        </div>
      )}

      {dateInvalid && (
        <div style={{ fontSize: '12px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <AlertCircle size={13} aria-hidden="true" /> La date de décès doit être postérieure à la date de naissance.
        </div>
      )}

      <label style={labelStyle}>
        Profession
        <input
          value={form.occupation || ''}
          onChange={e => set('occupation', e.target.value)}
          className="input" placeholder="Ex: Médecin, Ingénieur..."
        />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <label style={labelStyle}>
          Nationalité
          <input
            value={form.nationality || ''}
            onChange={e => set('nationality', e.target.value)}
            className="input" placeholder="Ex: Française"
          />
        </label>
        <label style={labelStyle}>
          Religion
          <input
            value={form.religion || ''}
            onChange={e => set('religion', e.target.value)}
            className="input" placeholder="Ex: Catholique"
          />
        </label>
      </div>

      <label style={labelStyle}>
        Éducation
        <input
          value={form.education || ''}
          onChange={e => set('education', e.target.value)}
          className="input" placeholder="Ex: Bac+5, Polytechnique..."
        />
      </label>

      <div style={labelStyle}>
        Photo de profil
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', textTransform: 'none', fontWeight: 400 }}>
          {form.profilePhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.profilePhoto} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }} />
          )}
          <input
            value={form.profilePhoto || ''}
            onChange={e => set('profilePhoto', e.target.value || undefined)}
            className="input" placeholder="Coller une URL https://… ou importer un fichier"
          />
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoFile} style={{ display: 'none' }} />
          <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>📷 Importer</button>
          {form.profilePhoto && (
            <button type="button" onClick={() => set('profilePhoto', undefined)} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', flexShrink: 0 }}>✕</button>
          )}
        </div>
        {photoError && <span style={{ color: 'var(--danger)', fontSize: '11px', textTransform: 'none', fontWeight: 400 }}>{photoError}</span>}
      </div>

      <label style={labelStyle}>
        Biographie
        <textarea
          value={form.bio || ''}
          onChange={e => set('bio', e.target.value)}
          className="input"
          rows={3}
          placeholder="Histoire, anecdotes, souvenirs..."
          style={{ resize: 'vertical' }}
        />
      </label>

      <label style={labelStyle}>
        Tags (séparés par des virgules)
        <input
          value={form.tags?.join(', ') || ''}
          onChange={e => set('tags', e.target.value ? e.target.value.split(',').map(t => t.trim()).filter(Boolean) : undefined)}
          className="input" placeholder="Ex: fondateur, médecin, sportif"
        />
      </label>

      {/* DNA / ethnic origins */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ ...labelStyle, marginBottom: 0 }}>🧬 Origines & ADN</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: dna.length === 0 ? 'var(--text-light)' : dnaInvalid ? 'var(--danger)' : 'var(--success)' }}>
            Total : {Math.round(dnaTotal)}%
          </span>
        </div>
        {dna.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
            {dna.map((d, i) => (
              <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  value={d.region}
                  onChange={e => updateDna(i, 'region', e.target.value)}
                  className="input" placeholder="Ex: Europe de l'Ouest" style={{ flex: 1 }}
                />
                <input
                  type="number" min={0} max={100}
                  value={d.percent || ''}
                  onChange={e => updateDna(i, 'percent', e.target.value)}
                  className="input" placeholder="%" style={{ width: '72px' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>%</span>
                <button type="button" onClick={() => removeDna(i)} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}>✕</button>
              </div>
            ))}
          </div>
        )}
        {dnaInvalid && (
          <div style={{ fontSize: '12px', color: 'var(--danger)', marginBottom: '8px' }}>
            La somme des pourcentages doit faire exactement 100% pour enregistrer.
          </div>
        )}
        <button type="button" onClick={addDna} disabled={dna.length >= 8} className="btn btn-secondary btn-sm" style={{ opacity: dna.length >= 8 ? 0.5 : 1 }}>
          ＋ Ajouter une origine {dna.length >= 8 && '(max 8)'}
        </button>
      </div>

      {/* Custom fields */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
        <span style={{ ...labelStyle, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><FolderOpen size={13} aria-hidden="true" /> Champs personnalisés</span>
        {cfEntries.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
            {cfEntries.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input value={c.key} onChange={e => updateCf(i, 'key', e.target.value)} className="input" placeholder="Clé (ex: Régiment)" style={{ flex: 1 }} />
                <input value={c.value} onChange={e => updateCf(i, 'value', e.target.value)} className="input" placeholder="Valeur" style={{ flex: 1 }} />
                <button type="button" onClick={() => removeCf(i)} aria-label="Retirer le champ" className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }}><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={addCf} className="btn btn-secondary btn-sm"><Plus size={14} /> Ajouter un champ</button>
      </div>

      <label style={labelStyle}>
        Confidentialité
        <select value={form.privacy || 'public'} onChange={e => set('privacy', e.target.value as Person['privacy'])} className="input">
          <option value="public">Public</option>
          <option value="family">Famille</option>
          <option value="private">Privé</option>
        </select>
      </label>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Annuler
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={blocked} style={{ opacity: blocked ? 0.5 : 1 }}>
          ✓ {submitLabel}
        </button>
      </div>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '4px',
  fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px'
};
