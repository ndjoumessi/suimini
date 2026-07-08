'use client';
import { useState, useRef, type ReactNode } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { AlertCircle, FolderOpen, Plus, X, Dna, ImageUp, Images, Check } from 'lucide-react';
import { Person, Gender } from '@/types';
import { uploadAvatar } from '@/lib/uploadImage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

interface Props {
  initial?: Partial<Person>;
  onSave: (data: Partial<Person>) => void;
  onCancel?: () => void;
  submitLabel?: string;
  /** Optional Relations editor (rendered as its own block; only PersonPanel passes it). */
  relationsSlot?: ReactNode;
}

export default function PersonForm({ initial, onSave, onCancel, submitLabel, relationsSlot }: Props) {
  const t = useTranslations('personForm');
  const locale = useLocale();
  const dateLang = locale === 'en' ? 'en-GB' : 'fr-FR';
  const dateExample = locale === 'en' ? 'e.g. 1950-04-12' : 'ex. 12/04/1950';
  const [form, setForm] = useState<Partial<Person>>({
    firstName: '', lastName: '', gender: 'unknown', isAlive: true,
    ...initial
  });
  const [cfEntries, setCfEntries] = useState<{ key: string; value: string }[]>(
    () => Object.entries(initial?.customFields || {}).map(([key, value]) => ({ key, value }))
  );
  const [photoError, setPhotoError] = useState('');
  const [photoNote, setPhotoNote] = useState('');
  const [photoLoading, setPhotoLoading] = useState(false);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const set = (field: keyof Person, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }));

  const personId = (initial?.id as string) || 'new';
  const photos = form.photos || [];

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError(''); setPhotoNote('');
    if (!file.type.startsWith('image/')) { setPhotoError(t('photoNotImage')); return; }
    if (file.size > 8 * 1024 * 1024) { setPhotoError(t('photoTooLarge')); return; }
    setPhotoLoading(true);
    try {
      const res = await uploadAvatar(file, personId);
      set('profilePhoto', res.url);
      if (res.warning) setPhotoNote(res.warning);
    } catch {
      setPhotoError(t('photoUploadFailed'));
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleGalleryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setGalleryLoading(true);
    try {
      const res = await uploadAvatar(file, personId);
      set('photos', [...photos, res.url]);
    } catch { /* ignore */ }
    finally { setGalleryLoading(false); }
  };
  const removePhoto = (i: number) => { const next = photos.filter((_, idx) => idx !== i); set('photos', next.length ? next : undefined); };

  const addCf = () => setCfEntries(e => [...e, { key: '', value: '' }]);
  const updateCf = (i: number, field: 'key' | 'value', val: string) =>
    setCfEntries(e => e.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  const removeCf = (i: number) => setCfEntries(e => e.filter((_, idx) => idx !== i));

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

  const dateInvalid = !!(!form.isAlive && form.birthDate && form.deathDate && form.deathDate < form.birthDate);
  // Nom unique traditionnel autorisé (ex. MESSE, TEDA) : au moins UN des deux champs.
  const nameMissing = !form.firstName?.trim() && !form.lastName?.trim();
  const blocked = nameMissing || dnaInvalid || dateInvalid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked || saving) return;
    const cleanDna = dna.filter(d => d.region.trim());
    const cf = cfEntries.filter(c => c.key.trim()).reduce<Record<string, string>>((acc, c) => { acc[c.key.trim()] = c.value; return acc; }, {});
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        ...form,
        dnaOrigins: cleanDna.length ? cleanDna : undefined,
        customFields: Object.keys(cf).length ? cf : undefined,
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const GENDERS: [Gender, string][] = [['male', t('genderMale')], ['female', t('genderFemale')], ['unknown', t('genderUnknown')]];

  return (
    <form onSubmit={handleSubmit} className="pf-form">
      <style>{PF_CSS}</style>

      {/* ===== BLOC 1 — Identité ===== */}
      <section className="pf-sec pf-sec-first">
        <div className="pf-sec-title">{t('sectionIdentity')}</div>
        <div className="pf-grid2">
          <label style={labelStyle}>{t('firstName')}
            <input value={form.firstName || ''} onChange={e => set('firstName', e.target.value)} className="input" placeholder={t('firstNamePlaceholder')} aria-required={nameMissing} aria-invalid={nameMissing || undefined} aria-describedby="pf-name-help" />
          </label>
          <label style={labelStyle}>{t('lastName')}
            <input value={form.lastName || ''} onChange={e => set('lastName', e.target.value)} className="input" placeholder={t('lastNamePlaceholder')} aria-required={nameMissing} aria-invalid={nameMissing || undefined} aria-describedby="pf-name-help" />
          </label>
        </div>
        {/* Relié aux deux champs (aria-describedby) ; en erreur, le poids graisse
            s'ajoute à la couleur (jamais la couleur seule — 1.4.1). */}
        <span id="pf-name-help" className="field-help" role={nameMissing ? 'alert' : undefined} style={{ color: nameMissing ? 'var(--danger)' : undefined, fontWeight: nameMissing ? 600 : undefined }}>{t('atLeastOneName')}</span>
        <div className="pf-grid2">
          <label style={labelStyle}>{t('maidenName')}
            <input value={form.maidenName || ''} onChange={e => set('maidenName', e.target.value)} className="input" placeholder={t('maidenNamePlaceholder')} />
          </label>
          <label style={labelStyle}>{t('nickName')}
            <input value={form.nickName || ''} onChange={e => set('nickName', e.target.value)} className="input" placeholder={t('nickNamePlaceholder')} />
          </label>
        </div>
        <div style={labelStyle}>
          <span id="pf-gender-label">{t('gender')}</span>
          <div className="pf-gender" role="group" aria-labelledby="pf-gender-label">
            {GENDERS.map(([g, lbl]) => (
              <button key={g} type="button" onClick={() => set('gender', g)} aria-pressed={form.gender === g}
                className={`pf-gender-btn ${form.gender === g ? `on on-${g}` : ''}`}>{lbl}</button>
            ))}
          </div>
        </div>
        <div className="pf-grid2">
          <label style={labelStyle}>{t('birthDate')}
            <input type="date" lang={dateLang} value={form.birthDate || ''} onChange={e => set('birthDate', e.target.value || undefined)} className="input" aria-invalid={dateInvalid || undefined} aria-describedby={dateInvalid ? 'pf-date-error' : undefined} />
            <span className="field-help">{dateExample}</span>
          </label>
          <label style={labelStyle}>{t('birthPlace')}
            <input value={form.birthPlace?.city || ''} onChange={e => set('birthPlace', e.target.value ? { ...(form.birthPlace || {}), city: e.target.value } : undefined)} className="input" placeholder={t('cityPlaceholder')} />
          </label>
        </div>
        <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: '8px', textTransform: 'none' }}>
          <input type="checkbox" checked={form.isAlive} onChange={e => set('isAlive', e.target.checked)} style={{ width: 'auto', cursor: 'pointer' }} />
          <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'var(--font-body)', color: 'var(--ink)', letterSpacing: 0 }}>{t('isAlive')}</span>
        </label>
        {!form.isAlive && (
          <div className="pf-grid2">
            <label style={labelStyle}>{t('deathDate')}
              <input type="date" lang={dateLang} value={form.deathDate || ''} onChange={e => set('deathDate', e.target.value || undefined)} className="input" aria-invalid={dateInvalid || undefined} aria-describedby={dateInvalid ? 'pf-date-error' : undefined} />
              <span className="field-help">{dateExample}</span>
            </label>
            <label style={labelStyle}>{t('deathPlace')}
              <input value={form.deathPlace?.city || ''} onChange={e => set('deathPlace', e.target.value ? { ...(form.deathPlace || {}), city: e.target.value } : undefined)} className="input" placeholder={t('cityPlaceholder')} />
            </label>
          </div>
        )}
        {dateInvalid && (
          <div id="pf-date-error" role="alert" style={{ fontSize: '12px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <AlertCircle size={13} aria-hidden="true" /> {t('dateError')}
          </div>
        )}
      </section>

      {/* ===== BLOC 2 — Biographie ===== */}
      <section className="pf-sec">
        <div className="pf-sec-title">{t('sectionBio')}</div>
        <label style={labelStyle}>{t('occupation')}
          <input value={form.occupation || ''} onChange={e => set('occupation', e.target.value)} className="input" placeholder={t('occupationPlaceholder')} />
        </label>
        <label style={labelStyle}>{t('bio')}
          <textarea value={form.bio || ''} onChange={e => set('bio', e.target.value)} className="input" rows={3} placeholder={t('bioPlaceholder')} style={{ resize: 'vertical' }} />
        </label>
      </section>

      {/* ===== BLOC 3 — Relations (injected by PersonPanel) ===== */}
      {relationsSlot && (
        <section className="pf-sec">
          <div className="pf-sec-title">{t('sectionRelations')}</div>
          {relationsSlot}
        </section>
      )}

      {/* ===== BLOC 4 — Avancé (collapsible) ===== */}
      <section className="pf-sec">
        <details className="pf-advanced">
          <summary className="pf-summary">{t('advancedSection')}</summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            <div className="pf-grid2">
              <label style={labelStyle}>{t('nationality')}
                <input value={form.nationality || ''} onChange={e => set('nationality', e.target.value)} className="input" placeholder={t('nationalityPlaceholder')} />
              </label>
              <label style={labelStyle}>{t('religion')}
                <input value={form.religion || ''} onChange={e => set('religion', e.target.value)} className="input" placeholder={t('religionPlaceholder')} />
              </label>
            </div>
            <label style={labelStyle}>{t('education')}
              <input value={form.education || ''} onChange={e => set('education', e.target.value)} className="input" placeholder={t('educationPlaceholder')} />
            </label>

            <div style={labelStyle}>{t('profilePhoto')}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', textTransform: 'none', fontWeight: 400 }}>
                {form.profilePhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.profilePhoto} alt="" style={{ width: '44px', height: '44px', objectFit: 'cover', border: '1.5px solid var(--border-strong)', flexShrink: 0 }} />
                )}
                <input value={form.profilePhoto?.startsWith('data:') ? '' : (form.profilePhoto || '')} onChange={e => set('profilePhoto', e.target.value || undefined)} className="input" aria-label={t('profilePhoto')} placeholder={form.profilePhoto?.startsWith('data:') ? t('photoImported') : t('photoUrlPlaceholder')} disabled={form.profilePhoto?.startsWith('data:')} />
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoFile} style={{ display: 'none' }} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={photoLoading} className="btn btn-secondary btn-sm" style={{ flexShrink: 0, opacity: photoLoading ? 0.7 : undefined }}>
                  {photoLoading ? <LoadingSpinner size={14} /> : <ImageUp size={14} />} {t('import')}
                </button>
                {form.profilePhoto && (
                  <button type="button" onClick={() => { set('profilePhoto', undefined); setPhotoNote(''); }} aria-label={t('removePhoto')} className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)', flexShrink: 0 }}><X size={14} /></button>
                )}
              </div>
              {photoError && <div style={{ textTransform: 'none', fontWeight: 400, marginTop: '6px' }}><ErrorMessage message={photoError} /></div>}
              {photoNote && <span style={{ color: 'var(--text-light)', fontSize: '11px', textTransform: 'none', fontWeight: 400 }}>{photoNote}</span>}
            </div>

            <div style={labelStyle}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Images size={13} aria-hidden="true" /> {t('gallery')}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px', textTransform: 'none', fontWeight: 400 }}>
                {photos.map((url, i) => (
                  <div key={i} style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', border: '1.5px solid var(--border-strong)' }} />
                    <button type="button" onClick={() => removePhoto(i)} aria-label={t('remove')}
                      style={{ position: 'absolute', top: '-8px', right: '-8px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', color: 'var(--danger)', border: '1.5px solid var(--border-strong)', cursor: 'pointer', padding: 0 }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <input ref={galleryRef} type="file" accept="image/*" onChange={handleGalleryFile} style={{ display: 'none' }} />
                <button type="button" onClick={() => galleryRef.current?.click()} disabled={galleryLoading}
                  style={{ width: '56px', height: '56px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-muted)', border: '1.5px dashed var(--border-strong)', cursor: 'pointer', color: 'var(--text-muted)', opacity: galleryLoading ? 0.7 : undefined }}>
                  {galleryLoading ? <LoadingSpinner size={18} /> : <Plus size={18} />}
                </button>
              </div>
              <input aria-label={t('galleryUrlPlaceholder')}
                onKeyDown={e => { const v = (e.target as HTMLInputElement).value.trim(); if (e.key === 'Enter' && v) { e.preventDefault(); set('photos', [...photos, v]); (e.target as HTMLInputElement).value = ''; } }}
                className="input" placeholder={t('galleryUrlPlaceholder')} style={{ marginTop: '8px', textTransform: 'none', fontWeight: 400 }} />
            </div>

            <label style={labelStyle}>{t('tags')}
              <input value={form.tags?.join(', ') || ''} onChange={e => set('tags', e.target.value ? e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) : undefined)} className="input" placeholder={t('tagsPlaceholder')} />
            </label>

            {/* DNA / ethnic origins */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ ...labelStyle, marginBottom: 0, display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Dna size={13} aria-hidden="true" /> {t('dnaTitle')}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: dna.length === 0 ? 'var(--text-light)' : dnaInvalid ? 'var(--danger)' : 'var(--success)' }}>
                  {t('dnaTotal', { total: Math.round(dnaTotal) })}
                </span>
              </div>
              {dna.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                  {dna.map((d, i) => (
                    <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input value={d.region} onChange={e => updateDna(i, 'region', e.target.value)} aria-label={t('dnaRegionPlaceholder')} className="input" placeholder={t('dnaRegionPlaceholder')} style={{ flex: 1 }} />
                      <input type="number" min={0} max={100} value={d.percent || ''} onChange={e => updateDna(i, 'percent', e.target.value)} aria-label={`${d.region || t('dnaRegionPlaceholder')} %`} className="input" placeholder="%" style={{ width: '72px' }} />
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }} aria-hidden="true">%</span>
                      <button type="button" onClick={() => removeDna(i)} aria-label={t('remove')} className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }}><X size={14} aria-hidden="true" /></button>
                    </div>
                  ))}
                </div>
              )}
              {dnaInvalid && <div role="alert" style={{ fontSize: '12px', color: 'var(--danger)', marginBottom: '8px' }}>{t('dnaSumError')}</div>}
              <button type="button" onClick={addDna} disabled={dna.length >= 8} className="btn btn-secondary btn-sm" style={{ opacity: dna.length >= 8 ? 0.5 : 1 }}>
                {t('dnaAdd')} {dna.length >= 8 && t('dnaMax')}
              </button>
            </div>

            {/* Custom fields */}
            <div>
              <span style={{ ...labelStyle, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><FolderOpen size={13} aria-hidden="true" /> {t('customFields')}</span>
              {cfEntries.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                  {cfEntries.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input value={c.key} onChange={e => updateCf(i, 'key', e.target.value)} className="input" aria-label={t('customKeyPlaceholder')} placeholder={t('customKeyPlaceholder')} style={{ flex: 1 }} />
                      <input value={c.value} onChange={e => updateCf(i, 'value', e.target.value)} className="input" aria-label={t('customValuePlaceholder')} placeholder={t('customValuePlaceholder')} style={{ flex: 1 }} />
                      <button type="button" onClick={() => removeCf(i)} aria-label={t('removeField')} className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }}><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={addCf} className="btn btn-secondary btn-sm"><Plus size={14} /> {t('addField')}</button>
            </div>

            <label style={labelStyle}>{t('privacy')}
              <select value={form.privacy || 'public'} onChange={e => set('privacy', e.target.value as Person['privacy'])} className="input">
                <option value="public">{t('privacyPublic')}</option>
                <option value="family">{t('privacyFamily')}</option>
                <option value="private">{t('privacyPrivate')}</option>
              </select>
            </label>
          </div>
        </details>
      </section>

      {saveError && <ErrorMessage message={saveError} />}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving} className="btn btn-ghost">{t('cancel')}</button>
        )}
        <button type="submit" className="btn btn-primary" disabled={blocked || saving} aria-busy={saving} style={{ opacity: (blocked || saving) ? (saving ? 0.7 : 0.5) : 1 }}>
          {saving ? <LoadingSpinner size={15} /> : <Check size={15} aria-hidden="true" />} {submitLabel ?? t('save')}
        </button>
      </div>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '5px',
  fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '700', color: '#a98f4e',
  textTransform: 'uppercase', letterSpacing: '0.1em'
};

const PF_CSS = `
.pf-form { display: flex; flex-direction: column; gap: 0; }
.pf-form .input { background: #1A1A24; border: 1px solid #2D2D3A; }
.pf-form .input::placeholder { color: var(--text-light); }
.pf-form .input:focus { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.pf-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 480px) { .pf-grid2 { grid-template-columns: 1fr; } }

/* sections separated by hairlines, mono gold-muted titles */
.pf-sec { display: flex; flex-direction: column; gap: 12px; padding: 18px 0; border-top: 1px solid #2D2D3A; }
.pf-sec-first { border-top: none; padding-top: 4px; }
.pf-sec-title { font-family: var(--font-mono); font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #a98f4e; }

/* gender toggle */
.pf-gender { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.pf-gender-btn { height: 40px; border: 1px solid #2D2D3A; background: #1A1A24; color: var(--text-muted); font-family: var(--font-body); font-size: 13px; font-weight: 600; letter-spacing: 0; text-transform: none; cursor: pointer; transition: border-color 150ms ease, color 150ms ease, background 150ms ease; }
.pf-gender-btn:hover { border-color: var(--accent); color: var(--ink); }
.pf-gender-btn.on { color: #0d0d0d; border-color: transparent; }
.pf-gender-btn.on-male { background: #4a90d9; }
.pf-gender-btn.on-female { background: #c47ba0; }
.pf-gender-btn.on-unknown { background: var(--accent); }

/* advanced disclosure */
.pf-advanced > summary::-webkit-details-marker { display: none; }
.pf-advanced > summary::marker { content: ''; }
.pf-summary { cursor: pointer; font-family: var(--font-mono); font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #a98f4e; user-select: none; list-style: none; }
.pf-summary::before { content: '▸'; margin-right: 6px; color: var(--accent-text); display: inline-block; transition: transform 150ms; }
.pf-advanced[open] > .pf-summary::before { transform: rotate(90deg); }

form .btn-primary svg.animate-spin { color: #0d0d0d !important; }
`;
