'use client';
import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Gender } from '@/types';
import { ArrowRight, Users, UserPlus, Gamepad2, Sparkles, ImageUp, X } from 'lucide-react';
import { uploadAvatar } from '@/lib/uploadImage';
import { useOverlay } from '@/hooks/useOverlay';

export interface OnboardingData {
  treeName: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  gender: Gender;
  profilePhoto?: string;
}

interface Props {
  /** Create the tree + root person and finish. */
  onComplete: (data: OnboardingData) => void;
  /** Dismiss without creating (still marks onboarded). */
  onSkip: () => void;
}

const GENDERS: { value: Gender; key: 'genderMale' | 'genderFemale' | 'genderOther' }[] = [
  { value: 'male', key: 'genderMale' },
  { value: 'female', key: 'genderFemale' },
  { value: 'other', key: 'genderOther' },
];

/* Stylized Atelier tree illustration (square nodes, ink rules, terracotta root). */
function TreeIllustration() {
  return (
    <svg width="132" height="108" viewBox="0 0 132 108" fill="none" aria-hidden="true" style={{ display: 'block' }}>
      <g stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="square">
        <path d="M66 30 V52 M30 52 H102 M30 52 V72 M102 52 V72" />
      </g>
      <rect x="50" y="6" width="32" height="26" fill="var(--accent)" stroke="var(--ink)" strokeWidth="2.5" />
      <rect x="14" y="72" width="32" height="26" fill="var(--bg-card)" stroke="var(--ink)" strokeWidth="2.5" />
      <rect x="86" y="72" width="32" height="26" fill="var(--bg-card)" stroke="var(--ink)" strokeWidth="2.5" />
    </svg>
  );
}

export default function OnboardingWizard({ onComplete, onSkip }: Props) {
  const t = useTranslations('onboarding');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [treeName, setTreeName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [photoLoading, setPhotoLoading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  // Focus-trap + Esc (= passer l'assistant) + restauration du focus. Le wizard
  // n'avait aucune gestion du focus : le clavier restait derrière la modale.
  const overlayRef = useOverlay<HTMLDivElement>(onSkip);

  const nameOk = treeName.trim().length > 0;
  const personOk = firstName.trim().length > 0 && lastName.trim().length > 0;

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setPhotoLoading(true);
    try {
      const res = await uploadAvatar(file, 'new');
      setProfilePhoto(res.url);
    } catch { /* ignore */ }
    finally { setPhotoLoading(false); }
  };

  function finish() {
    onComplete({
      treeName: treeName.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate: birthDate || undefined,
      gender,
      profilePhoto: profilePhoto || undefined,
    });
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={t('ariaTitle')} style={overlay}>
      <div ref={overlayRef} tabIndex={-1} style={card} className="animate-scale-in">
        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <span className="label" style={{ color: 'var(--accent)' }}>{t('step', { step })}</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[1, 2, 3].map(n => (
              <span key={n} style={{ width: n === step ? '26px' : '10px', height: '10px', background: n <= step ? 'var(--accent)' : 'var(--bg-muted)', border: '1.5px solid var(--border-strong)', transition: 'all .25s' }} />
            ))}
          </div>
        </div>

        {/* ===== STEP 1 ===== */}
        {step === 1 && (
          <div className="animate-fade-in" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}><TreeIllustration /></div>
            <div className="label" style={{ marginBottom: '8px' }}>{t('welcome')}</div>
            <h2 className="serif" style={title}>{t('step1Title')}</h2>
            <p style={para}>{t('step1Desc')}</p>
            <label className="label" style={fieldLabel} htmlFor="ob-tree">{t('treeNameLabel')}</label>
            <input id="ob-tree" className="input" autoFocus value={treeName} onChange={e => setTreeName(e.target.value)}
              placeholder={t('treeNamePlaceholder')} style={{ marginBottom: '20px' }}
              onKeyDown={e => { if (e.key === 'Enter' && nameOk) setStep(2); }} />
            <button className="btn btn-primary btn-lg" style={fullBtn} disabled={!nameOk} onClick={() => setStep(2)}>
              {t('createFirst')} <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* ===== STEP 2 ===== */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="serif" style={{ ...title, textAlign: 'left' }}>{t('step2Title')}</h2>
            <p style={{ ...para, textAlign: 'left', margin: '0 0 20px' }}>{t('step2Desc')}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="label" style={fieldLabel} htmlFor="ob-fn">{t('firstNameLabel')}</label>
                <input id="ob-fn" className="input" autoFocus value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={t('firstNamePlaceholder')} />
              </div>
              <div>
                <label className="label" style={fieldLabel} htmlFor="ob-ln">{t('lastNameLabel')}</label>
                <input id="ob-ln" className="input" value={lastName} onChange={e => setLastName(e.target.value)} placeholder={t('lastNamePlaceholder')} />
              </div>
            </div>

            <label className="label" style={{ ...fieldLabel, marginTop: '14px' }} htmlFor="ob-bd">{t('birthDateLabel')}</label>
            <input id="ob-bd" type="date" className="input" value={birthDate} onChange={e => setBirthDate(e.target.value)} />

            <span className="label" style={{ ...fieldLabel, marginTop: '14px', display: 'block' }}>{t('genderLabel')}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {GENDERS.map(g => {
                const active = gender === g.value;
                return (
                  <button key={g.value} type="button" onClick={() => setGender(g.value)}
                    className="btn btn-sm" aria-pressed={active}
                    style={{ flex: 1, background: active ? 'var(--accent)' : 'var(--bg-card)', color: active ? '#fff' : 'var(--text)' }}>
                    {t(g.key)}
                  </button>
                );
              })}
            </div>

            <span className="label" style={{ ...fieldLabel, marginTop: '14px', display: 'block' }}>{t('photoLabel')}</span>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ width: '48px', height: '48px', flexShrink: 0, border: '1.5px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: 'var(--accent)' }}>
                {profilePhoto
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <UserPlus size={20} aria-hidden="true" />}
              </div>
              <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
              <button type="button" onClick={() => photoRef.current?.click()} disabled={photoLoading} className="btn btn-secondary btn-sm">
                {photoLoading ? <span className="spinner" /> : <ImageUp size={14} />} {profilePhoto ? t('photoChange') : t('photoImport')}
              </button>
              {profilePhoto && (
                <button type="button" onClick={() => setProfilePhoto('')} aria-label={t('photoRemove')} className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }}><X size={14} /></button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>{t('back')}</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!personOk} onClick={() => setStep(3)}>
                {t('continueBtn')} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 3 ===== */}
        {step === 3 && (
          <div className="animate-fade-in" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px', color: 'var(--accent)' }}><Sparkles size={40} strokeWidth={1.4} aria-hidden="true" /></div>
            <h2 className="serif" style={title}>{t('step3Title')}</h2>
            <div style={summaryBox}>
              {t.rich('summary', { tree: treeName.trim(), name: firstName.trim(), b: (c) => <strong>{c}</strong> })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '18px 0 24px', textAlign: 'left' }}>
              <Suggestion Icon={Users} text={t('suggParents')} />
              <Suggestion Icon={UserPlus} text={t('suggInvite')} />
              <Suggestion Icon={Gamepad2} text={t('suggDemo')} />
            </div>
            <button className="btn btn-primary btn-lg" style={fullBtn} onClick={finish}>
              {t('startExploring')} <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Skip */}
        <div style={{ textAlign: 'center', marginTop: '18px' }}>
          <button onClick={onSkip} className="btn btn-ghost btn-sm">{t('skip')}</button>
        </div>
      </div>
    </div>
  );
}

function Suggestion({ Icon, text }: { Icon: typeof Users; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-card)', border: '1.5px solid var(--border-strong)', borderRadius: 'var(--radius)' }}>
      <span style={{ width: '30px', height: '30px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-light)', border: '1.5px solid var(--border-strong)', color: 'var(--accent)' }}><Icon size={15} aria-hidden="true" /></span>
      <span style={{ fontSize: '14px', fontWeight: 600 }}>{text}</span>
      <ArrowRight size={15} style={{ marginLeft: 'auto', color: 'var(--text-light)' }} aria-hidden="true" />
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 4000, background: 'var(--bg)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '20px', overflowY: 'auto',
};
const card: React.CSSProperties = {
  width: '100%', maxWidth: '560px', background: 'var(--bg-card)',
  border: 'var(--bw) solid var(--border-strong)', borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-xl)', padding: '32px 32px 24px',
};
const title: React.CSSProperties = { fontSize: '1.9rem', margin: '0 0 10px', lineHeight: 1.1 };
const para: React.CSSProperties = { fontSize: '15px', lineHeight: 1.6, color: 'var(--text-muted)', margin: '0 0 22px' };
const fieldLabel: React.CSSProperties = { display: 'block', textAlign: 'left', marginBottom: '6px' };
const fullBtn: React.CSSProperties = { width: '100%', justifyContent: 'center', gap: '8px' };
const summaryBox: React.CSSProperties = {
  fontSize: '15px', lineHeight: 1.6, color: 'var(--text)', background: 'var(--accent-light)',
  border: '1.5px solid var(--border-strong)', borderRadius: 'var(--radius)', padding: '14px 16px',
};
