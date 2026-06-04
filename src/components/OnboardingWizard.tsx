'use client';
import { useState } from 'react';
import { Gender } from '@/types';
import { ArrowRight, Users, UserPlus, Gamepad2, Sparkles } from 'lucide-react';

export interface OnboardingData {
  treeName: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  gender: Gender;
}

interface Props {
  /** Create the tree + root person and finish. */
  onComplete: (data: OnboardingData) => void;
  /** Dismiss without creating (still marks onboarded). */
  onSkip: () => void;
}

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Homme' },
  { value: 'female', label: 'Femme' },
  { value: 'other', label: 'Autre' },
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [treeName, setTreeName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<Gender>('male');

  const nameOk = treeName.trim().length > 0;
  const personOk = firstName.trim().length > 0 && lastName.trim().length > 0;

  function finish() {
    onComplete({
      treeName: treeName.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate: birthDate || undefined,
      gender,
    });
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Bienvenue sur Suimini" style={overlay}>
      <div style={card} className="animate-scale-in">
        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <span className="label" style={{ color: 'var(--accent)' }}>Étape {step} / 3</span>
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
            <div className="label" style={{ marginBottom: '8px' }}>Bienvenue sur Suimini</div>
            <h2 className="serif" style={title}>Commençons votre arbre</h2>
            <p style={para}>Suimini vous aide à préserver l&apos;histoire de votre famille. Commençons par créer votre premier arbre généalogique.</p>
            <label className="label" style={fieldLabel} htmlFor="ob-tree">Nom de l&apos;arbre</label>
            <input id="ob-tree" className="input" autoFocus value={treeName} onChange={e => setTreeName(e.target.value)}
              placeholder="Ex : Famille Dupont" style={{ marginBottom: '20px' }}
              onKeyDown={e => { if (e.key === 'Enter' && nameOk) setStep(2); }} />
            <button className="btn btn-primary btn-lg" style={fullBtn} disabled={!nameOk} onClick={() => setStep(2)}>
              Créer mon premier arbre <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* ===== STEP 2 ===== */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="serif" style={{ ...title, textAlign: 'left' }}>Ajoutez-vous</h2>
            <p style={{ ...para, textAlign: 'left', margin: '0 0 20px' }}>Vous serez la racine de votre arbre.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="label" style={fieldLabel} htmlFor="ob-fn">Prénom *</label>
                <input id="ob-fn" className="input" autoFocus value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Marie" />
              </div>
              <div>
                <label className="label" style={fieldLabel} htmlFor="ob-ln">Nom *</label>
                <input id="ob-ln" className="input" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Dupont" />
              </div>
            </div>

            <label className="label" style={{ ...fieldLabel, marginTop: '14px' }} htmlFor="ob-bd">Date de naissance</label>
            <input id="ob-bd" type="date" className="input" value={birthDate} onChange={e => setBirthDate(e.target.value)} />

            <span className="label" style={{ ...fieldLabel, marginTop: '14px', display: 'block' }}>Genre</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {GENDERS.map(g => {
                const active = gender === g.value;
                return (
                  <button key={g.value} type="button" onClick={() => setGender(g.value)}
                    className="btn btn-sm" aria-pressed={active}
                    style={{ flex: 1, background: active ? 'var(--accent)' : 'var(--bg-card)', color: active ? '#fff' : 'var(--text)' }}>
                    {g.label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>Retour</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!personOk} onClick={() => setStep(3)}>
                Continuer <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 3 ===== */}
        {step === 3 && (
          <div className="animate-fade-in" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px', color: 'var(--accent)' }}><Sparkles size={40} strokeWidth={1.4} aria-hidden="true" /></div>
            <h2 className="serif" style={title}>Vous êtes prêt(e) !</h2>
            <div style={summaryBox}>
              Arbre <strong>« {treeName.trim()} »</strong> créé avec <strong>{firstName.trim()}</strong> comme racine.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '18px 0 24px', textAlign: 'left' }}>
              <Suggestion Icon={Users} text="Ajouter vos parents" />
              <Suggestion Icon={UserPlus} text="Inviter un proche" />
              <Suggestion Icon={Gamepad2} text="Explorer la démo" />
            </div>
            <button className="btn btn-primary btn-lg" style={fullBtn} onClick={finish}>
              Commencer à explorer <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Skip */}
        <div style={{ textAlign: 'center', marginTop: '18px' }}>
          <button onClick={onSkip} className="btn btn-ghost btn-sm">Passer pour l&apos;instant</button>
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
