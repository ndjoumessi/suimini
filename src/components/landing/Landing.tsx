'use client';
import { useState, useEffect, useRef } from 'react';
import {
  TreePine, Sparkles, Users, ArrowRight, ChevronDown, Check, Mail, Heart,
  ShieldCheck, Gamepad2, X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import AuthModal from '@/components/AuthModal';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { BrandLockup } from '@/components/Brand';

/* ===== Editorial Heritage palette (theme-aware vars; light-locked) ===== */
const BONE = 'var(--bg)';            // archival cream
const PAPER = 'var(--bg-card)';      // white card surfaces
const INK = 'var(--text)';           // ink
const ACCENT = 'var(--accent)';      // muted gold (fills / rules)
const ACCENT_TX = 'var(--accent-text)'; // deep bronze (small gold text → AA)
const MUTED = 'var(--text-muted)';   // secondary
const FAINT = 'var(--text-light)';   // tertiary
const LINE = 'var(--border)';        // hairline rules
const RULE = 'var(--border-strong)'; // strong editorial rule
const DARK = '#1a1714';              // ink section background
const ON_DARK = '#fbf7ef';           // cream text on ink
const ON_DARK_MUTED = '#b8b0a2';     // muted text on ink

/* ---------- Scroll reveal (Intersection Observer, no lib, reduced-motion aware) ---------- */
function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [instant, setInstant] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInstant(true); setShown(true); return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ ...style, opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(28px)', transition: instant ? 'none' : `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms` }}>
      {children}
    </div>
  );
}

/* ---------- Editorial section eyebrow ---------- */
function Eyebrow({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return <div className="lp-eyebrow" style={onDark ? { color: ACCENT } : undefined}>{children}</div>;
}

/* ---------- Simple ink/gold SVG illustrations (no screenshots) ---------- */
function ArtTree() {
  return (
    <svg viewBox="0 0 320 240" width="100%" role="img" aria-label="Arbre généalogique" className="lp-art">
      <g stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="square" opacity="0.85">
        <path d="M160 56 V92 M70 92 H250 M70 92 V128 M250 92 V128" />
        <path d="M70 156 V188 M34 188 H106 M34 188 V210 M106 188 V210" />
        <path d="M250 156 V188 M214 188 H286 M214 188 V210 M286 188 V210" />
      </g>
      {[
        { x: 132, y: 22, root: true }, { x: 44, y: 128 }, { x: 224, y: 128 },
        { x: 12, y: 210 }, { x: 84, y: 210 }, { x: 192, y: 210 }, { x: 264, y: 210 },
      ].map((n, i) => (
        <g key={i}>
          <rect x={n.x} y={n.y} width="56" height="34" fill={n.root ? ACCENT : PAPER} stroke="var(--ink)" strokeWidth="2" />
          {!n.root && <rect x={n.x} y={n.y} width="56" height="5" fill={ACCENT} />}
        </g>
      ))}
    </svg>
  );
}
function ArtScript() {
  return (
    <svg viewBox="0 0 320 240" width="100%" role="img" aria-label="Récit familial" className="lp-art">
      <rect x="64" y="34" width="170" height="172" fill={PAPER} stroke="var(--ink)" strokeWidth="2" />
      <g stroke="var(--border-strong)" strokeWidth="2" opacity="0.5">
        <path d="M86 78 H212 M86 98 H212 M86 118 H188 M86 138 H212 M86 158 H170" />
      </g>
      <path d="M86 58 q14 -10 28 0" stroke={ACCENT} strokeWidth="3" fill="none" />
      <g stroke={ACCENT} strokeWidth="2.4" fill="none">
        <path d="M236 36 L264 64 L214 114 L196 116 L198 98 Z" fill={PAPER} />
        <path d="M196 116 L186 126" />
      </g>
    </svg>
  );
}
function ArtShield() {
  return (
    <svg viewBox="0 0 320 240" width="100%" role="img" aria-label="Données protégées" className="lp-art">
      <path d="M160 30 L236 58 V128 q0 56 -76 82 q-76 -26 -76 -82 V58 Z" fill={PAPER} stroke="var(--ink)" strokeWidth="2" />
      <path d="M124 124 l26 26 l50 -58" stroke={ACCENT} strokeWidth="5" fill="none" strokeLinecap="square" />
    </svg>
  );
}

/* 3 deep-dive features, alternating text / illustration */
const FEATURES: { eyebrow: string; title: string; body: string; bullets: string[]; Art: () => React.ReactNode }[] = [
  {
    eyebrow: 'L’arbre',
    title: 'Une lignée qui se parcourt du regard',
    body: 'Naviguez sur sept générations dans un arbre clair et vivant — zoom, recentrage, fiches détaillées. Chaque branche raconte une partie de votre histoire.',
    bullets: ['Visualisation interactive jusqu’à 7 générations', 'Fiches riches : dates, lieux, photos, biographies', 'Carte des origines et chronologie familiale'],
    Art: ArtTree,
  },
  {
    eyebrow: 'Le récit',
    title: 'L’histoire de votre famille, écrite pour vous',
    body: 'À partir de vos données, l’IA compose un récit narratif élégant — la mémoire de votre famille, en quelques phrases justes, prête à être transmise.',
    bullets: ['Récit narratif généré automatiquement', 'Reconnaissance des visages sur vos photos', 'Export en livret PDF à offrir'],
    Art: ArtScript,
  },
  {
    eyebrow: 'La confiance',
    title: 'À l’épreuve du temps, et respectueux',
    body: 'Vos données vous appartiennent. Hébergées en Europe, chiffrées, exportables à tout moment — et utilisables hors connexion.',
    bullets: ['RGPD · données hébergées en Europe', 'Import / export GEDCOM standard', 'Fonctionne hors-ligne (PWA installable)'],
    Art: ArtShield,
  },
];

/* 3 short value columns */
const WHY = [
  { Icon: TreePine, title: 'Visualisez', desc: 'Un arbre interactif et élégant, pensé pour être contemplé autant que consulté.' },
  { Icon: Sparkles, title: 'Racontez', desc: 'L’IA tisse le récit de votre lignée à partir des dates, lieux et liens.' },
  { Icon: Users, title: 'Partagez', desc: 'Invitez vos proches ; chacun contribue à la mémoire commune, en temps réel.' },
];

/* Key figures (the TEDA reference family) */
const STATS = [
  { value: '7', unit: 'générations', label: 'de mémoire reconstituée' },
  { value: '58', unit: 'membres', label: 'reliés dans un seul arbre' },
  { value: '~1870', unit: '', label: 'la racine la plus ancienne' },
];

const PLANS = [
  { name: 'Gratuit', price: '0€', period: '/mois', popular: false, cta: 'Commencer gratuitement',
    features: ['1 arbre généalogique', '50 personnes max', 'Import/Export GEDCOM', 'Rapport IA (3/mois)'] },
  { name: 'Famille', price: '9€', period: '/mois', popular: true, cta: 'Choisir ce plan',
    features: ['5 arbres', '500 personnes', 'Collaboration famille', 'Rapport IA illimité', 'Galerie photos', 'Sync cloud'] },
  { name: 'Pro', price: '19€', period: '/mois', popular: false, cta: 'Nous contacter',
    features: ['Arbres illimités', 'Personnes illimitées', 'Multi-organisations', 'API access', 'Support prioritaire', 'Export PDF avancé'] },
];

const FAQS = [
  { q: 'Mes données sont-elles en sécurité ?', a: 'Vos données sont chiffrées en transit (SSL) et hébergées en Europe (Supabase, Stockholm). En mode invité, tout reste sur votre appareil. Vous restez propriétaire de vos données et pouvez les exporter à tout moment.' },
  { q: 'Puis-je importer un fichier GEDCOM ?', a: 'Oui. Suimini importe les fichiers GEDCOM (.ged) standards : individus, familles, relations parent-enfant et mariages sont reconstruits automatiquement.' },
  { q: 'Comment fonctionne la collaboration ?', a: 'Invitez des proches par e-mail avec un accès en lecture ou écriture. Les modifications se synchronisent en temps réel et chacun voit qui est connecté sur l’arbre.' },
  { q: 'Ai-je besoin d’un compte pour essayer ?', a: 'Non. Le mode invité fonctionne entièrement hors-ligne avec des données d’exemple. Créez un compte uniquement lorsque vous souhaitez sauvegarder dans le cloud.' },
  { q: 'Puis-je exporter mon arbre ?', a: 'Oui : export JSON (sauvegarde complète), GEDCOM (standard universel) et PDF (liste, fiches, résumé ou arbre visuel A3).' },
  { q: 'Suimini est-il payant ?', a: 'Le plan Gratuit suffit pour démarrer. Les plans Famille et Pro débloquent la synchronisation cloud, le partage et la collaboration temps réel.' },
];

function FaqItem({ q, a, idx }: { q: string; a: string; idx: number }) {
  const [open, setOpen] = useState(false);
  const panelId = `faq-answer-${idx}`;
  return (
    <div style={{ borderTop: `1px solid ${LINE}` }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls={panelId}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '22px 4px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '1.25rem', fontWeight: 600, color: INK, fontFamily: 'var(--font-display)', letterSpacing: '-0.005em' }}>
        {q}
        <ChevronDown size={20} style={{ flexShrink: 0, transition: 'transform 0.3s ease', transform: open ? 'rotate(180deg)' : 'none', color: ACCENT }} />
      </button>
      <div id={panelId} role="region" style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s ease' }}>
        <div style={{ overflow: 'hidden' }}>
          <p style={{ margin: 0, padding: '0 4px 22px', color: MUTED, lineHeight: 1.75, fontSize: '15px', maxWidth: '70ch' }}>{a}</p>
        </div>
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Landing() {
  const t = useTranslations('landing');
  const ta = useTranslations('auth');
  const { startDemo, user, isDemo, isApproved } = useAuth();
  const canEnterApp = isDemo || (!!user && isApproved);
  const goToApp = () => { if (typeof window !== 'undefined') window.location.href = '/app'; };
  const displayName = ((user?.user_metadata?.display_name as string | undefined) || '').trim();
  const firstName = displayName ? displayName.split(/\s+/)[0] : '';
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('signup');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
    else setInstallDismissed(true);
  };

  const openAuth = (tab: 'login' | 'signup') => { setAuthTab(tab); setShowAuth(true); };
  const startSignup = () => openAuth('signup');

  return (
    <div className="lp-root">
      {/* ===================== STICKY NAVBAR ===================== */}
      <nav className="lp-nav">
        <BrandLockup size={26} color={INK} accent={ACCENT} surface={PAPER} fontSize={22} />
        <div className="lp-nav-links">
          <a href="#why">À propos</a>
          <a href="#features">Fonctions</a>
          <a href="#tarifs">Tarifs</a>
          <a href="#faq">FAQ</a>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <LanguageSwitcher tone="landing" />
          {canEnterApp ? (
            <button onClick={goToApp} className="lp-btn lp-btn-primary lp-btn-nav">Accéder à l’app <ArrowRight size={15} /></button>
          ) : (
            <button onClick={() => openAuth('login')} className="lp-btn lp-btn-ghost">{ta('login')}</button>
          )}
        </div>
      </nav>

      {/* ===================== 1 · HERO ===================== */}
      <header className="lp-hero">
        <div className="lp-grid-bg" aria-hidden="true" />
        <div className="lp-hero-inner">
          <Reveal><Eyebrow>Arbre généalogique · Est. 2026</Eyebrow></Reveal>
          <Reveal delay={80}>
            <h1 className="lp-tagline">
              {t('hero.title')}
              <span className="lp-tagline-accent">{t('hero.titleAccent')}</span>
            </h1>
          </Reveal>
          <Reveal delay={160}><p className="lp-subtitle">{t('hero.subtitle')}</p></Reveal>
          <Reveal delay={240}>
            {canEnterApp ? (
              <p className="lp-hero-welcome">
                {firstName
                  ? t.rich('hero.welcome', { name: firstName, hl: (chunks) => <strong>{chunks}</strong> })
                  : t('hero.welcomeGeneric')}
              </p>
            ) : (
              <>
                <div className="lp-cta-row">
                  <button onClick={startSignup} className="lp-btn lp-btn-primary lp-btn-hero">{t('hero.cta')}</button>
                  <button onClick={startDemo} className="lp-btn lp-btn-ghost lp-btn-hero"><Gamepad2 size={17} /> {t('demo.cta')}</button>
                </div>
                <div className="lp-hero-login">
                  <button onClick={() => openAuth('login')} className="lp-link">{t('hero.loginLink')}</button>
                </div>
              </>
            )}
          </Reveal>
          <Reveal delay={320}>
            <div className="lp-trust">
              <span><Check size={14} /> Gratuit pour commencer</span>
              <span><Check size={14} /> Sans carte bancaire</span>
              <span><ShieldCheck size={14} /> Données en Europe</span>
            </div>
          </Reveal>
        </div>
        <a href="#why" className="lp-scroll" aria-label="Faire défiler"><span className="lp-scroll-line" /><ChevronDown size={20} /></a>
      </header>

      {/* ===================== 2 · POURQUOI SUIMINI ===================== */}
      <section id="why" className="lp-section">
        <div className="lp-shell">
          <Reveal><Eyebrow>Pourquoi Suimini</Eyebrow></Reveal>
          <Reveal delay={60}><h2 className="lp-h2">Le soin d’un livre, la vie d’une application</h2></Reveal>
          <Reveal delay={120}>
            <p className="lp-lead dropcap">Suimini réunit la rigueur d’un arbre généalogique et l’émotion d’un récit de famille. Une mémoire que l’on consulte, que l’on enrichit, et que l’on transmet — sans rien perdre de son élégance.</p>
          </Reveal>
          <div className="lp-why">
            {WHY.map((w, k) => (
              <Reveal key={w.title} delay={k * 80} style={{ height: '100%' }}>
                <div className="lp-why-card">
                  <w.Icon size={28} strokeWidth={1.4} style={{ color: ACCENT }} aria-hidden="true" />
                  <h3 className="lp-why-title">{w.title}</h3>
                  <p className="lp-why-desc">{w.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== 3 · FEATURES (alternance) ===================== */}
      <section id="features" className="lp-section lp-section-paper">
        <div className="lp-shell">
          <Reveal><Eyebrow>Les fonctions</Eyebrow></Reveal>
          <Reveal delay={60}><h2 className="lp-h2">Tout ce qu’il faut pour votre histoire</h2></Reveal>
          <div className="lp-feats">
            {FEATURES.map((f, k) => (
              <Reveal key={f.title} delay={40}>
                <article className={`lp-feat ${k % 2 ? 'lp-feat-rev' : ''}`}>
                  <div className="lp-feat-text">
                    <div className="lp-feat-eyebrow lp-mono">{f.eyebrow}</div>
                    <h3 className="lp-feat-title">{f.title}</h3>
                    <p className="lp-feat-body">{f.body}</p>
                    <ul className="lp-feat-list">
                      {f.bullets.map(b => <li key={b}><span className="lp-dash" aria-hidden="true">—</span>{b}</li>)}
                    </ul>
                  </div>
                  <div className="lp-feat-art"><f.Art /></div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== 4 · CHIFFRES CLÉS ===================== */}
      <section className="lp-section lp-stats-section">
        <div className="lp-shell">
          <Reveal><Eyebrow>Une mémoire vivante</Eyebrow></Reveal>
          <Reveal delay={60}><h2 className="lp-h2">Ce qu’une famille peut reconstituer</h2></Reveal>
          <div className="lp-stats">
            {STATS.map((s, k) => (
              <Reveal key={s.unit || s.value} delay={k * 90} style={{ height: '100%' }}>
                <div className="lp-stat">
                  <div className="lp-stat-num">{s.value}{s.unit && <span className="lp-stat-unit"> {s.unit}</span>}</div>
                  <div className="lp-stat-label lp-mono">{s.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== 5 · TARIFS ===================== */}
      <section id="tarifs" className="lp-section lp-section-paper">
        <div className="lp-shell">
          <Reveal><Eyebrow>Les tarifs</Eyebrow></Reveal>
          <Reveal delay={60}><h2 className="lp-h2">Commencez gratuitement, évoluez plus tard</h2></Reveal>
          <div className="lp-pricing">
            {PLANS.map((p, k) => (
              <Reveal key={p.name} delay={k * 80} style={{ height: '100%' }}>
                <div className={`lp-plan ${p.popular ? 'lp-plan-popular' : ''}`}>
                  {p.popular && <span className="lp-plan-badge lp-mono">Populaire</span>}
                  <h3 className="lp-plan-name">{p.name}</h3>
                  <div className="lp-plan-price"><span>{p.price}</span><small className="lp-mono">{p.period}</small></div>
                  <ul className="lp-plan-features">
                    {p.features.map(f => <li key={f}><Check size={16} style={{ color: p.popular ? ACCENT : ACCENT_TX, flexShrink: 0 }} /> {f}</li>)}
                  </ul>
                  {p.name === 'Pro' ? (
                    <a href="mailto:hello@suimini.app?subject=Suimini%20Pro" className={`lp-btn ${p.popular ? 'lp-btn-ghost' : 'lp-btn-primary'}`} style={{ width: '100%', justifyContent: 'center' }}>{p.cta}</a>
                  ) : (
                    <button onClick={startSignup} className={`lp-btn ${p.popular ? 'lp-btn-ghost' : 'lp-btn-primary'}`} style={{ width: '100%', justifyContent: 'center' }}>{p.cta}</button>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== 6 · FAQ ===================== */}
      <section id="faq" className="lp-section">
        <div className="lp-shell lp-shell-narrow">
          <Reveal><Eyebrow>Questions fréquentes</Eyebrow></Reveal>
          <Reveal delay={60}><h2 className="lp-h2">Tout ce que vous voulez savoir</h2></Reveal>
          <Reveal delay={120}>
            <div className="lp-faq">
              {FAQS.map((f, i) => <FaqItem key={f.q} {...f} idx={i} />)}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===================== 7 · CTA FINALE (ink) ===================== */}
      <section className="lp-cta">
        <Reveal>
          <div className="lp-cta-inner">
            <Eyebrow onDark>Votre tour</Eyebrow>
            <h2 className="lp-cta-title">Votre histoire mérite<br />d’être préservée.</h2>
            <p className="lp-cta-sub">Chaque famille porte un récit. Donnez au vôtre la place qu’il mérite — élégant, vivant, transmis.</p>
            <div className="lp-cta-row" style={{ justifyContent: 'center', marginTop: '30px' }}>
              {canEnterApp ? (
                <button onClick={goToApp} className="lp-btn lp-btn-primary lp-btn-hero">Accéder à l’app <ArrowRight size={18} /></button>
              ) : (
                <button onClick={startSignup} className="lp-btn lp-btn-primary lp-btn-hero">Créer mon arbre <ArrowRight size={18} /></button>
              )}
              {!canEnterApp && (
                <button onClick={startDemo} className="lp-btn lp-btn-outline-light lp-btn-hero"><Gamepad2 size={17} /> Voir la démo</button>
              )}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ===================== 8 · FOOTER (cream) ===================== */}
      <footer className="lp-footer">
        <div className="lp-footer-grid">
          <div className="lp-footer-brand">
            <BrandLockup size={26} color={INK} accent={ACCENT} surface={PAPER} fontSize={22} style={{ marginBottom: '14px' }} />
            <p className="lp-footer-tag">Préservez l’histoire de votre famille, génération après génération.</p>
            <span className="lp-footer-badge lp-mono"><ShieldCheck size={13} /> Données hébergées en Europe</span>
          </div>
          <div className="lp-footer-links">
            <span className="lp-foot-h lp-mono">Produit</span>
            <a href="#features">Fonctions</a>
            <a href="#tarifs">Tarifs</a>
            <a href="#faq">FAQ</a>
            <button onClick={startDemo} className="lp-footer-linkbtn">Essayer la démo</button>
          </div>
          <div className="lp-footer-links">
            <span className="lp-foot-h lp-mono">Légal</span>
            <a href="/cgu">Conditions générales</a>
            <a href="/confidentialite">Confidentialité</a>
            <a href="/cgu">Mentions légales</a>
          </div>
          <div className="lp-footer-links">
            <span className="lp-foot-h lp-mono">Contact</span>
            <a href="mailto:hello@suimini.app"><Mail size={13} /> hello@suimini.app</a>
            <a href="#">GitHub</a>
            <a href="#">Twitter/X @suimini</a>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© 2026 Suimini · Tous droits réservés</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>Fait avec <Heart size={12} aria-label="amour" style={{ color: ACCENT, fill: ACCENT }} /> en France</span>
        </div>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} initialTab={authTab} />}

      {/* PWA install prompt */}
      {installPrompt && !installDismissed && (
        <div className="lp-install">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '17px' }}>Installer Suimini</div>
            <div style={{ fontSize: '12px', color: ON_DARK_MUTED, marginTop: '2px', fontFamily: 'var(--font-mono)' }}>Accès rapide, fonctionne hors-ligne</div>
          </div>
          <button onClick={handleInstall} className="lp-btn lp-btn-primary" style={{ flexShrink: 0, padding: '9px 16px', fontSize: '13px' }}>Installer</button>
          <button onClick={() => setInstallDismissed(true)} aria-label="Fermer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: ON_DARK_MUTED, padding: '4px', flexShrink: 0, display: 'inline-flex', lineHeight: 1 }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      <style>{LANDING_CSS}</style>
    </div>
  );
}

const LANDING_CSS = `
.lp-root { background: ${BONE}; color: ${INK}; font-family: var(--font-body); overflow-x: hidden; }
.lp-mono { font-family: var(--font-mono); }
.lp-shell { max-width: 1140px; margin: 0 auto; }
.lp-shell-narrow { max-width: 820px; }

/* Eyebrow */
.lp-eyebrow { font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 2.5px; font-size: 11px; font-weight: 500; color: ${ACCENT_TX}; text-align: center; margin: 0 auto 16px; }

/* Nav */
.lp-nav { position: sticky; top: 0; z-index: 50; display: flex; align-items: center; gap: 16px; justify-content: space-between; padding: 14px 28px; background: color-mix(in srgb, ${BONE} 86%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid ${LINE}; }
.lp-nav-links { display: flex; gap: 30px; }
.lp-nav-links a { color: ${INK}; text-decoration: none; font-size: 15px; transition: color 0.15s; }
.lp-nav-links a:hover { color: ${ACCENT_TX}; }
@media (max-width: 860px) { .lp-nav-links { display: none; } }

/* Buttons — editorial: flat, gold fill / ink outline */
.lp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; font-family: var(--font-body); font-weight: 700; font-size: 15px; border-radius: 0; padding: 13px 24px; border: 1px solid transparent; transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; text-decoration: none; line-height: 1.2; }
.lp-btn-primary { background: ${ACCENT}; color: #fff; border-color: ${ACCENT}; }
.lp-btn-primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); box-shadow: var(--shadow-accent); }
.lp-btn-ghost { background: transparent; color: ${INK}; border-color: ${RULE}; }
.lp-btn-ghost:hover { background: ${INK}; color: ${BONE}; border-color: ${INK}; }
.lp-btn-outline-light { background: transparent; color: ${ON_DARK}; border-color: rgba(244,241,234,0.5); }
.lp-btn-outline-light:hover { background: ${ON_DARK}; color: ${DARK}; border-color: ${ON_DARK}; }
.lp-btn-nav { padding: 9px 16px; font-size: 14px; }
.lp-btn-hero { padding: 15px 30px; font-size: 16px; }
.lp-btn:active { transform: translateY(1px); }

/* Links */
.lp-link { background: none; border: none; padding: 0; color: ${ACCENT_TX}; font-weight: 700; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; font-family: var(--font-body); font-size: inherit; }
.lp-link:hover { color: ${INK}; }
.lp-hero-login { margin-top: 20px; font-size: 15px; color: ${MUTED}; }

/* ===== HERO ===== */
.lp-hero { position: relative; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }
.lp-grid-bg { position: absolute; inset: 0; pointer-events: none; opacity: 0.6;
  background-image: radial-gradient(${RULE} 1px, transparent 1px); background-size: 26px 26px;
  -webkit-mask-image: radial-gradient(120% 75% at 50% 0%, #000 30%, transparent 72%);
  mask-image: radial-gradient(120% 75% at 50% 0%, #000 30%, transparent 72%); }
.lp-hero-inner { position: relative; z-index: 2; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 80px 24px 96px; max-width: 1100px; margin: 0 auto; }
.lp-tagline { font-family: var(--font-display); font-weight: 700; font-size: clamp(4rem, 8vw, 9rem); line-height: 0.94; letter-spacing: -0.02em; margin: 18px 0 22px; color: ${INK}; }
.lp-tagline-accent { display: block; color: ${ACCENT}; }
.lp-subtitle { font-family: var(--font-body); font-size: clamp(1.05rem, 1.8vw, 1.35rem); color: ${MUTED}; max-width: 30ch; margin: 0 auto 34px; line-height: 1.6; }
.lp-cta-row { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
.lp-hero-welcome { margin: 0; font-size: clamp(1.1rem, 2.4vw, 1.45rem); line-height: 1.5; color: ${MUTED}; font-style: italic; }
.lp-hero-welcome strong { font-family: var(--font-display); font-weight: 600; font-style: normal; color: ${INK}; }
.lp-trust { margin-top: 36px; display: flex; gap: 24px; flex-wrap: wrap; justify-content: center; }
.lp-trust span { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: ${MUTED}; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.6px; }
.lp-trust svg { color: ${ACCENT}; flex-shrink: 0; }

/* Scroll indicator */
.lp-scroll { position: absolute; bottom: 26px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px; color: ${ACCENT}; z-index: 2; text-decoration: none; }
.lp-scroll-line { width: 1px; height: 38px; background: linear-gradient(${ACCENT}, transparent); animation: lpPulse 1.9s ease-in-out infinite; }
.lp-scroll svg { animation: lpBounce 1.9s ease-in-out infinite; }
@keyframes lpBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
@keyframes lpPulse { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }

/* ===== Sections ===== */
.lp-section { padding: clamp(72px, 10vw, 128px) 24px; }
.lp-section-paper { background: ${PAPER}; border-top: 1px solid ${LINE}; border-bottom: 1px solid ${LINE}; }
.lp-h2 { font-family: var(--font-display); font-weight: 600; font-size: clamp(2rem, 4.4vw, 3.2rem); text-align: center; margin: 0 auto; max-width: 18ch; line-height: 1.08; letter-spacing: -0.01em; }
.lp-lead { max-width: 64ch; margin: 28px auto 0; text-align: left; font-size: 1.12rem; line-height: 1.8; color: ${MUTED}; }

/* 2 · Why columns */
.lp-why { display: grid; grid-template-columns: repeat(3, 1fr); margin: 56px auto 0; border-top: 1px solid ${LINE}; }
.lp-why-card { height: 100%; padding: 36px 28px; border-left: 1px solid ${LINE}; }
.lp-why-card:first-child { border-left: none; }
.lp-why-title { font-family: var(--font-display); font-weight: 600; font-size: 1.7rem; margin: 16px 0 8px; letter-spacing: -0.01em; }
.lp-why-title::after { content: ''; display: block; width: 36px; height: 2px; background: ${ACCENT}; margin-top: 12px; }
.lp-why-desc { font-size: 15px; color: ${MUTED}; line-height: 1.7; margin: 0; }

/* 3 · Features alternating */
.lp-feats { margin: 56px auto 0; display: flex; flex-direction: column; gap: clamp(48px, 7vw, 92px); }
.lp-feat { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(32px, 6vw, 80px); align-items: center; }
.lp-feat-rev .lp-feat-text { order: 2; }
.lp-feat-eyebrow { text-transform: uppercase; letter-spacing: 2px; font-size: 11px; color: ${ACCENT_TX}; margin-bottom: 12px; }
.lp-feat-title { font-family: var(--font-display); font-weight: 600; font-size: clamp(1.6rem, 3vw, 2.3rem); line-height: 1.12; letter-spacing: -0.01em; margin: 0 0 16px; }
.lp-feat-body { font-size: 1.05rem; line-height: 1.75; color: ${MUTED}; margin: 0 0 22px; max-width: 46ch; }
.lp-feat-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
.lp-feat-list li { display: flex; gap: 12px; align-items: baseline; font-size: 15px; color: ${INK}; line-height: 1.5; }
.lp-dash { color: ${ACCENT}; font-weight: 700; flex-shrink: 0; }
.lp-feat-art { border: 1px solid ${LINE}; background: ${BONE}; padding: clamp(20px, 4vw, 44px); }
.lp-feat-rev .lp-feat-art { order: 1; }
.lp-art { display: block; }

/* 4 · Stats */
.lp-stats-section { text-align: center; }
.lp-stats { display: grid; grid-template-columns: repeat(3, 1fr); margin: 56px auto 0; border-top: 2px solid ${ACCENT}; }
.lp-stat { padding: 44px 24px; border-left: 1px solid ${LINE}; }
.lp-stat:first-child { border-left: none; }
.lp-stat-num { font-family: var(--font-display); font-weight: 600; font-size: clamp(3rem, 6vw, 4.6rem); line-height: 1; color: ${ACCENT_TX}; letter-spacing: -0.01em; }
.lp-stat-unit { font-size: 0.4em; color: ${INK}; font-weight: 500; letter-spacing: 0; }
.lp-stat-label { display: block; margin-top: 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: ${MUTED}; }

/* 5 · Pricing */
.lp-pricing { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; max-width: 1040px; margin: 56px auto 0; align-items: stretch; }
.lp-plan { position: relative; height: 100%; background: ${BONE}; border: 1px solid ${LINE}; padding: 32px 28px; display: flex; flex-direction: column; transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
.lp-plan:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); border-color: ${ACCENT}; }
.lp-plan-popular { background: ${PAPER}; border: 1px solid ${ACCENT}; box-shadow: var(--shadow); }
.lp-plan-badge { position: absolute; top: -11px; left: 28px; background: ${ACCENT}; color: #fff; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 12px; }
.lp-plan-name { font-family: var(--font-display); font-weight: 600; font-size: 1.6rem; margin: 0 0 12px; }
.lp-plan-price { margin-bottom: 22px; display: flex; align-items: baseline; gap: 4px; }
.lp-plan-price span { font-family: var(--font-display); font-weight: 600; font-size: 2.8rem; color: ${INK}; }
.lp-plan-price small { color: ${FAINT}; font-size: 13px; }
.lp-plan-features { list-style: none; padding: 18px 0 0; margin: 0 0 26px; flex: 1; display: flex; flex-direction: column; gap: 12px; border-top: 1px solid ${LINE}; }
.lp-plan-features li { display: flex; gap: 9px; align-items: center; font-size: 14.5px; color: ${MUTED}; }

/* 6 · FAQ */
.lp-faq { margin: 44px auto 0; border-bottom: 1px solid ${LINE}; }

/* 7 · CTA finale (ink) */
.lp-cta { background: ${DARK}; color: ${ON_DARK}; padding: clamp(80px, 12vw, 150px) 24px; text-align: center; }
.lp-cta-inner { max-width: 760px; margin: 0 auto; }
.lp-cta-title { font-family: var(--font-display); font-weight: 600; font-size: clamp(2.4rem, 6vw, 4.4rem); line-height: 1.02; color: ${ON_DARK}; letter-spacing: -0.015em; margin: 0; }
.lp-cta-sub { font-size: 1.1rem; line-height: 1.7; color: ${ON_DARK_MUTED}; max-width: 50ch; margin: 22px auto 0; font-style: italic; font-family: var(--font-display); }

/* 8 · Footer (cream) */
.lp-footer { background: ${BONE}; color: ${INK}; padding: 64px 24px 30px; border-top: 2px solid ${ACCENT}; }
.lp-footer-grid { max-width: 1140px; margin: 0 auto; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; padding-bottom: 30px; border-bottom: 1px solid ${LINE}; }
.lp-footer-brand { min-width: 0; }
.lp-footer-tag { color: ${MUTED}; font-size: 14px; line-height: 1.7; margin: 0 0 16px; max-width: 300px; }
.lp-footer-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; letter-spacing: 0.5px; color: ${MUTED}; border: 1px solid ${LINE}; padding: 6px 11px; }
.lp-footer-links { display: flex; flex-direction: column; align-items: flex-start; gap: 11px; font-size: 15px; }
.lp-footer-links a, .lp-footer-linkbtn { color: ${MUTED}; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: color 0.15s; font-family: var(--font-body); }
.lp-footer-links a:hover, .lp-footer-linkbtn:hover { color: ${ACCENT_TX}; }
.lp-footer-linkbtn { background: none; border: none; padding: 0; cursor: pointer; font-size: 15px; text-align: left; }
.lp-foot-h { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: ${FAINT}; margin-bottom: 4px; }
.lp-footer-bottom { max-width: 1140px; margin: 22px auto 0; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 11px; letter-spacing: 0.5px; color: ${FAINT}; text-transform: uppercase; font-family: var(--font-mono); }

/* Install prompt */
.lp-install { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: var(--z-toast); display: flex; align-items: center; gap: 14px; background: ${DARK}; color: ${ON_DARK}; border: 1px solid ${ACCENT}; box-shadow: var(--shadow-lg); padding: 14px 20px; max-width: calc(100vw - 48px); width: 400px; }

/* ===== Responsive ===== */
@media (max-width: 900px) {
  .lp-feat, .lp-feat-rev { grid-template-columns: 1fr; gap: 28px; }
  .lp-feat-rev .lp-feat-text, .lp-feat-rev .lp-feat-art { order: 0; }
  .lp-feat-art { max-width: 420px; }
}
@media (max-width: 760px) {
  .lp-why { grid-template-columns: 1fr; }
  .lp-why-card { border-left: none; border-top: 1px solid ${LINE}; padding: 28px 4px; }
  .lp-why-card:first-child { border-top: none; }
  .lp-stats { grid-template-columns: 1fr; }
  .lp-stat { border-left: none; border-top: 1px solid ${LINE}; }
  .lp-stat:first-child { border-top: none; }
  .lp-pricing { grid-template-columns: 1fr; }
  .lp-footer-grid { grid-template-columns: 1fr 1fr; gap: 32px; }
  .lp-footer-brand { grid-column: 1 / -1; }
}
@media (prefers-reduced-motion: reduce) {
  .lp-scroll-line, .lp-scroll svg { animation: none !important; }
}
`;
