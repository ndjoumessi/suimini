'use client';
import { useState, useEffect, useRef } from 'react';
import {
  TreePine, Map, Cloud, Search, BookOpen, Play, BarChart2, Dna,
  ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Check, Mail,
  KeyRound, UserPlus, Share2, ShieldCheck, Star, Gamepad2, X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import AuthModal from '@/components/AuthModal';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { BrandLockup } from '@/components/Brand';

/* Atelier palette as THEME-AWARE CSS vars so the landing follows dark mode.
   The footer and the "ink" feature sections stay intentionally dark in both
   themes — those use the DARK / ON_DARK literals. */
const BONE = 'var(--bg)';            // page background (bone light / near-black dark)
const PAPER = 'var(--bg-card)';      // card surfaces
const INK = 'var(--text)';           // primary text
const LINE = 'var(--border-strong)'; // structural borders + hard shadows
const ACCENT = 'var(--accent)';      // terracotta in both themes
const MUTED = 'var(--text-muted)';   // secondary text
const FAINT = 'var(--text-light)';   // tertiary text
const DARK = '#161412';              // always-dark surfaces (ink sections)
const ON_DARK = '#f4f1ea';           // text on always-dark surfaces

/* ---------- Scroll reveal (Intersection Observer, no lib) ---------- */
function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ ...style, opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(24px)', transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms` }}>
      {children}
    </div>
  );
}

const FEATURES = [
  { Icon: TreePine, title: 'Arbre interactif', desc: 'Visualisez 5 générations d’un seul coup d’œil.', badge: false },
  { Icon: Map, title: 'Carte des origines', desc: 'Découvrez d’où vient votre famille.', badge: false },
  { Icon: Cloud, title: 'Sync cloud', desc: 'Accessible sur tous vos appareils, toujours sauvegardé.', badge: true },
  { Icon: Search, title: 'Exploration', desc: 'Trouvez les liens entre n’importe quels membres.', badge: false },
  { Icon: BookOpen, title: 'Journal familial', desc: 'Racontez l’histoire en mots et en photos.', badge: true },
  { Icon: Play, title: 'Mode présentation', desc: 'Partagez lors des réunions de famille.', badge: false },
  { Icon: BarChart2, title: 'Statistiques', desc: 'Analysez les tendances de votre lignée.', badge: false },
  { Icon: Dna, title: 'Profil ADN', desc: 'Visualisez vos origines ethniques.', badge: true },
];

const STEPS = [
  { Icon: KeyRound, title: 'Créez votre compte', desc: 'Magic link par e-mail, sans mot de passe.' },
  { Icon: UserPlus, title: 'Ajoutez vos ancêtres', desc: 'Formulaire simple ou import GEDCOM.' },
  { Icon: Share2, title: 'Partagez avec la famille', desc: 'Lien, export PDF, collaboration temps réel.' },
];

const TESTIMONIALS = [
  { name: 'Awa Diallo', loc: 'Dakar → Lyon', seed: 'Awa', quote: 'J’ai retrouvé le village de mon arrière-grand-père et relié quatre générations. Émouvant.' },
  { name: 'Mathieu Lefèvre', loc: 'Nantes', seed: 'Mathieu', quote: 'Enfin un outil élégant. Toute la famille collabore sur le même arbre, en temps réel.' },
  { name: 'Sofia Romano', loc: 'Milan → Bruxelles', seed: 'Sofia', quote: 'La carte des origines m’a fait découvrir des branches italiennes que j’ignorais totalement.' },
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

function Testimonials() {
  const [i, setI] = useState(0);
  const t = TESTIMONIALS[i];
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
      <div className="lp-fade" key={i}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://api.dicebear.com/7.x/personas/svg?seed=${t.seed}`} alt="" width={72} height={72}
          loading="lazy" decoding="async"
          style={{ border: `2px solid ${LINE}`, background: PAPER, marginBottom: '20px' }} />
        <p className="serif" style={{ fontSize: 'clamp(1.3rem, 3vw, 2rem)', lineHeight: 1.18, letterSpacing: '-0.02em', margin: '0 0 18px' }}>
          « {t.quote} »
        </p>
        <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', marginBottom: '10px', color: ACCENT }}>
          {[0, 1, 2, 3, 4].map(s => <Star key={s} size={15} fill={ACCENT} />)}
        </div>
        <div className="lp-mono" style={{ fontWeight: 700 }}>{t.name}</div>
        <div className="lp-mono" style={{ fontSize: '12px', color: ACCENT, marginTop: '2px' }}>{t.loc}</div>
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '24px', alignItems: 'center' }}>
        <button className="lp-icon-btn" aria-label="Témoignage précédent" onClick={() => setI(p => (p - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)}><ChevronLeft size={18} /></button>
        {TESTIMONIALS.map((_, k) => (
          <button key={k} aria-label={`Aller au témoignage ${k + 1}`} onClick={() => setI(k)}
            style={{ width: k === i ? '24px' : '10px', height: '10px', border: `1.5px solid ${LINE}`, cursor: 'pointer', padding: 0, background: k === i ? ACCENT : PAPER, transition: 'all 0.25s' }} />
        ))}
        <button className="lp-icon-btn" aria-label="Témoignage suivant" onClick={() => setI(p => (p + 1) % TESTIMONIALS.length)}><ChevronRight size={18} /></button>
      </div>
    </div>
  );
}

function FaqItem({ q, a, idx }: { q: string; a: string; idx: number }) {
  const [open, setOpen] = useState(false);
  const panelId = `faq-answer-${idx}`;
  return (
    <div style={{ borderTop: `1.5px solid ${LINE}` }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls={panelId}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '20px 4px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '17px', fontWeight: 700, color: INK, fontFamily: "var(--font-display)", letterSpacing: '-0.01em' }}>
        {q}
        <ChevronDown size={20} style={{ flexShrink: 0, transition: 'transform 0.3s ease', transform: open ? 'rotate(180deg)' : 'none', color: ACCENT }} />
      </button>
      <div id={panelId} role="region" style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s ease' }}>
        <div style={{ overflow: 'hidden' }}>
          <p style={{ margin: 0, padding: '0 4px 20px', color: MUTED, lineHeight: 1.7, fontSize: '15px', maxWidth: '70ch' }}>{a}</p>
        </div>
      </div>
    </div>
  );
}

// Type for the non-standard BeforeInstallPromptEvent (Chrome/Android).
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Landing() {
  const t = useTranslations('landing');
  const ta = useTranslations('auth');
  const { startDemo, user, isDemo, isApproved } = useAuth();
  // Approved members (or active demo) get a direct "Accéder à l'app" entry instead
  // of the sign-in CTAs — the landing stays visible, entry to /app is manual.
  const canEnterApp = isDemo || (!!user && isApproved);
  const goToApp = () => { if (typeof window !== 'undefined') window.location.href = '/app'; };
  // Prénom pour l'accueil discret du hero (vide en démo ou sans nom → message générique).
  const displayName = ((user?.user_metadata?.display_name as string | undefined) || '').trim();
  const firstName = displayName ? displayName.split(/\s+/)[0] : '';
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('signup');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
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
      {/* La DemoBanner ne s'affiche que dans /app (rendue par SuiminiApp), pas sur la landing. */}

      {/* ===================== STICKY NAVBAR ===================== */}
      <nav className="lp-nav">
        <BrandLockup size={26} color={INK} accent={ACCENT} surface={PAPER} fontSize={20} />
        <div className="lp-nav-links">
          <a href="#features">Fonctions</a>
          <a href="#tarifs">Tarifs</a>
          <a href="#faq">FAQ</a>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <LanguageSwitcher tone="landing" />
          {canEnterApp ? (
            <button onClick={goToApp} className="lp-btn-primary lp-btn-nav">Accéder à l’app <ArrowRight size={15} /></button>
          ) : (
            <button onClick={() => openAuth('login')} className="lp-btn-ghost">{ta('login')}</button>
          )}
        </div>
      </nav>

      {/* ===================== HERO ===================== */}
      <header className="lp-hero">
        <div className="lp-grid-bg" aria-hidden="true" />
        <div className="lp-hero-inner">
          <Reveal>
            <div className="lp-eyebrow">Arbre généalogique · Est. 2026</div>
          </Reveal>
          <Reveal delay={70}>
            <h1 className="serif lp-tagline">{t('hero.title')}<br /><span className="lp-tagline-accent">{t('hero.titleAccent')}</span></h1>
          </Reveal>
          <Reveal delay={150}>
            <p className="lp-subtitle">{t('hero.subtitle')}</p>
          </Reveal>
          <Reveal delay={230}>
            <div className="lp-cta-row">
              {canEnterApp ? (
                // Le bouton "Accéder à l'app" vit dans la navbar ; ici, un accueil chaleureux discret.
                <p className="lp-hero-welcome">
                  {firstName
                    ? t.rich('hero.welcome', { name: firstName, hl: (chunks) => <strong>{chunks}</strong> })
                    : t('hero.welcomeGeneric')}
                </p>
              ) : (
                <button onClick={startSignup} className="lp-btn-primary lp-btn-hero">{t('hero.cta')}</button>
              )}
            </div>
            {!canEnterApp && (
              <div className="lp-hero-login">
                <button onClick={() => openAuth('login')} className="lp-link">{t('hero.loginLink')}</button>
              </div>
            )}
          </Reveal>
          <Reveal delay={310}>
            <div className="lp-trust">
              <span><Check size={14} /> Gratuit pour commencer</span>
              <span><Check size={14} /> Sans carte bancaire</span>
              <span><ShieldCheck size={14} /> Données hébergées en Europe</span>
            </div>
          </Reveal>
        </div>
        <a href="#features" className="lp-scroll" aria-label="Faire défiler"><ChevronDown size={26} /></a>
      </header>

      {/* ===================== FEATURES BENTO ===================== */}
      <section id="features" className="lp-section">
        <Reveal><div className="lp-eyebrow lp-eyebrow-center">Les fonctions</div></Reveal>
        <Reveal delay={60}><h2 className="serif lp-h2">Tout ce qu’il faut pour votre histoire familiale</h2></Reveal>
        <div className="lp-bento">
          {FEATURES.map((f, k) => (
            <Reveal key={f.title} delay={k * 50} style={{ height: '100%' }}>
              <div className="lp-card">
                <div className="lp-card-top">
                  <div className="lp-card-icon"><f.Icon size={22} /></div>
                  <span className="lp-mono lp-card-num">N°{String(k + 1).padStart(2, '0')}</span>
                </div>
                {f.badge && <span className="lp-badge lp-mono">Nouveau</span>}
                <h3 className="serif lp-card-title">{f.title}</h3>
                <p className="lp-card-desc">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===================== SECTION DÉMO ===================== */}
      <section id="demo" className="lp-section">
        <div className="lp-demo-panel">
          <Reveal><div className="lp-eyebrow lp-eyebrow-center">La démo</div></Reveal>
          <Reveal delay={60}><h2 className="serif lp-h2" style={{ maxWidth: '560px' }}>{t('demo.title')}</h2></Reveal>
          <Reveal delay={120}><p className="lp-demo-sub">{t('demo.subtitle')}</p></Reveal>
          <Reveal delay={170}>
            <button onClick={startDemo} className="lp-btn-secondary lp-btn-hero"><Gamepad2 size={18} /> {t('demo.cta')}</button>
            <div className="lp-demo-note lp-mono" style={{ marginTop: '14px' }}>{t('demo.noSignup')}</div>
          </Reveal>
        </div>
      </section>

      {/* ===================== SCREENSHOT MOCKUP ===================== */}
      <section className="lp-section lp-section-ink">
        <Reveal><div className="lp-eyebrow lp-eyebrow-center" style={{ color: ACCENT }}>L’interface</div></Reveal>
        <Reveal delay={60}><h2 className="serif lp-h2" style={{ color: ON_DARK }}>Une interface qui donne vie à votre lignée</h2></Reveal>
        <Reveal delay={120}>
          <div className="lp-mockup">
            <div className="lp-browser">
              <div className="lp-browser-bar">
                <span className="lp-dot" /><span className="lp-dot" /><span className="lp-dot" />
                <div className="lp-url lp-mono">suimini.app/app</div>
              </div>
              <div className="lp-browser-body">
                <svg viewBox="0 0 640 320" width="100%" role="img" aria-label="Aperçu de l’arbre généalogique">
                  <g stroke={INK} strokeWidth="2.5" opacity="0.85" fill="none" strokeLinecap="square">
                    <path d="M320 70 V110 M180 110 H460 M180 110 V150 M460 110 V150" />
                    <path d="M180 210 V250 M110 250 H250 M110 250 V270 M250 250 V270" />
                    <path d="M460 210 V250 M390 250 H530 M390 250 V270 M530 250 V270" />
                  </g>
                  {[
                    { x: 290, y: 30, c: ACCENT, d: 0 },
                    { x: 150, y: 150, c: 'var(--male)', d: 1 },
                    { x: 430, y: 150, c: 'var(--female)', d: 2 },
                    { x: 80, y: 270, c: 'var(--male)', d: 3 },
                    { x: 220, y: 270, c: 'var(--female)', d: 4 },
                    { x: 360, y: 270, c: 'var(--male)', d: 5 },
                    { x: 500, y: 270, c: 'var(--female)', d: 6 },
                  ].map((n, k) => (
                    <g key={k} className="lp-node" style={{ animationDelay: `${n.d * 0.13}s` }}>
                      <rect x={n.x} y={n.y} width="62" height="42" fill={PAPER} stroke={INK} strokeWidth="2.5" />
                      <rect x={n.x} y={n.y} width="62" height="6" fill={n.c} />
                      <rect x={n.x + 9} y={n.y + 17} width="14" height="14" fill={n.c} />
                      <rect x={n.x + 29} y={n.y + 18} width="24" height="4" fill="var(--text-light)" />
                      <rect x={n.x + 29} y={n.y + 27} width="17" height="3" fill="var(--border)" />
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <section className="lp-section">
        <Reveal><div className="lp-eyebrow lp-eyebrow-center">La méthode</div></Reveal>
        <Reveal delay={60}><h2 className="serif lp-h2">Commencez en trois étapes</h2></Reveal>
        <div className="lp-steps">
          {STEPS.map((s, k) => (
            <Reveal key={s.title} delay={k * 90} style={{ flex: 1 }}>
              <div className="lp-step">
                <div className="serif lp-step-num">{String(k + 1).padStart(2, '0')}</div>
                <div className="lp-step-icon"><s.Icon size={22} /></div>
                <h3 className="serif lp-card-title">{s.title}</h3>
                <p className="lp-card-desc">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===================== TESTIMONIALS ===================== */}
      <section className="lp-section lp-section-muted">
        <Reveal><div className="lp-eyebrow lp-eyebrow-center">Témoignages</div></Reveal>
        <Reveal delay={60}><h2 className="serif lp-h2" style={{ marginBottom: '40px' }}>Ils ont retrouvé leurs racines</h2></Reveal>
        <Reveal delay={120}><Testimonials /></Reveal>
      </section>

      {/* ===================== TARIFS ===================== */}
      <section id="tarifs" className="lp-section">
        <Reveal><div className="lp-eyebrow lp-eyebrow-center">Les tarifs</div></Reveal>
        <Reveal delay={60}><h2 className="serif lp-h2">Commencez gratuitement, évoluez plus tard</h2></Reveal>
        <div className="lp-pricing">
          {PLANS.map((p, k) => (
            <Reveal key={p.name} delay={k * 80} style={{ height: '100%' }}>
              <div className={`lp-plan ${p.popular ? 'lp-plan-popular' : ''}`}>
                {p.popular && <span className="lp-plan-badge lp-mono">Populaire</span>}
                <h3 className="serif lp-plan-name">{p.name}</h3>
                <div className="lp-plan-price"><span className="serif">{p.price}</span><small className="lp-mono">{p.period}</small></div>
                <ul className="lp-plan-features">
                  {p.features.map(f => <li key={f}><Check size={16} style={{ color: p.popular ? '#fff' : ACCENT, flexShrink: 0 }} /> {f}</li>)}
                </ul>
                {p.name === 'Pro' ? (
                  <a href="mailto:hello@suimini.app?subject=Suimini%20Pro" className={p.popular ? 'lp-btn-secondary' : 'lp-btn-primary'} style={{ width: '100%', justifyContent: 'center' }}>{p.cta}</a>
                ) : (
                  <button onClick={startSignup} className={p.popular ? 'lp-btn-secondary' : 'lp-btn-primary'} style={{ width: '100%', justifyContent: 'center' }}>{p.cta}</button>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===================== FAQ ===================== */}
      <section id="faq" className="lp-section">
        <Reveal><div className="lp-eyebrow lp-eyebrow-center">Questions fréquentes</div></Reveal>
        <Reveal delay={60}><h2 className="serif lp-h2">Tout ce que vous voulez savoir</h2></Reveal>
        <Reveal delay={120}>
          <div className="lp-faq">
            {FAQS.map((f, i) => <FaqItem key={f.q} {...f} idx={i} />)}
          </div>
        </Reveal>
      </section>

      {/* ===================== CTA BANNER ===================== */}
      <section className="lp-section lp-section-ink lp-cta-banner">
        <Reveal>
          <h2 className="serif lp-cta-title">Votre histoire mérite<br />d’être préservée.</h2>
          <div className="lp-cta-row" style={{ justifyContent: 'center', marginTop: '28px' }}>
            {canEnterApp ? (
              <button onClick={goToApp} className="lp-btn-primary lp-btn-hero">Accéder à l’app <ArrowRight size={18} /></button>
            ) : (
              <button onClick={startSignup} className="lp-btn-primary lp-btn-hero">Créer mon arbre <ArrowRight size={18} /></button>
            )}
          </div>
          {!canEnterApp && (
            <div style={{ marginTop: '18px' }}>
              <button onClick={startDemo} className="lp-link-light">ou explorer la démo d’abord →</button>
            </div>
          )}
        </Reveal>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="lp-footer">
        <div className="lp-footer-grid">
          <div style={{ maxWidth: '280px' }}>
            <BrandLockup size={26} color={ON_DARK} accent={ACCENT} surface="#0f0d0b" fontSize={20} style={{ marginBottom: '12px' }} />
            <p style={{ color: '#b8b2a6', fontSize: '13px', lineHeight: 1.6 }}>L’arbre généalogique moderne : structuré, collaboratif, et toujours avec vous.</p>
          </div>
          <div className="lp-footer-links">
            <span className="lp-foot-h lp-mono">Liens utiles</span>
            <a href="#features">Fonctions</a>
            <a href="#tarifs">Tarifs</a>
            <a href="#faq">FAQ</a>
            <a href="/confidentialite">Confidentialité</a>
            <a href="/cgu">CGU</a>
          </div>
          <div className="lp-footer-links">
            <span className="lp-foot-h lp-mono">Suimini</span>
            <a href="/app">Ouvrir l’app</a>
            <a href="mailto:hello@suimini.app"><Mail size={13} /> hello@suimini.app</a>
          </div>
        </div>
        <div className="lp-footer-bottom lp-mono">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><ShieldCheck size={14} /> Données hébergées en Europe · Chiffrement SSL</span>
          <span>© 2026 Suimini · Tous droits réservés</span>
        </div>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} initialTab={authTab} />}

      {/* PWA install prompt — appears on Android/Chrome when the app is installable. */}
      {installPrompt && !installDismissed && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 'var(--z-toast)',
          display: 'flex', alignItems: 'center', gap: '14px',
          background: INK, color: BONE, border: `2px solid ${ACCENT}`,
          boxShadow: `6px 6px 0 ${ACCENT}`,
          padding: '14px 20px', maxWidth: 'calc(100vw - 48px)', width: '400px',
          fontFamily: 'var(--font-body)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em' }}>
              Installer Suimini
            </div>
            <div style={{ fontSize: '12px', color: '#b8b2a6', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
              Accès rapide, fonctionne hors-ligne
            </div>
          </div>
          <button onClick={handleInstall} className="lp-btn-primary" style={{ flexShrink: 0, padding: '8px 16px', fontSize: '13px' }}>
            Installer
          </button>
          <button onClick={() => setInstallDismissed(true)} aria-label="Fermer"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8a8276', padding: '4px', flexShrink: 0, display: 'inline-flex', lineHeight: 1 }}>
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
.lp-root .serif { font-family: var(--font-display); font-weight: 700; letter-spacing: -0.02em; }
.lp-mono { font-family: var(--font-mono); }

/* Eyebrow */
.lp-eyebrow { font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 2.5px; font-size: 12px; font-weight: 700; color: ${ACCENT}; }
.lp-eyebrow-center { text-align: center; display: block; margin: 0 auto 14px; }

/* Nav — translucent themed backdrop (color-mix keeps the blur in both themes) */
.lp-nav { position: sticky; top: 0; z-index: 50; display: flex; align-items: center; gap: 16px; justify-content: space-between; padding: 14px 24px; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(8px); border-bottom: 1.5px solid ${LINE}; }
.lp-nav-links { display: flex; gap: 26px; }
.lp-nav-links a { color: ${INK}; text-decoration: none; font-size: 14px; font-weight: 600; transition: color 0.15s; }
.lp-nav-links a:hover { color: ${ACCENT}; }
@media (max-width: 768px) { .lp-nav-links { display: none; } }

/* Buttons */
.lp-btn-primary, .lp-btn-secondary, .lp-btn-outline-light, .lp-btn-ghost {
  display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
  font-family: var(--font-body); font-weight: 700; font-size: 15px;
  border-radius: 2px; padding: 12px 22px; border: 2px solid ${LINE};
  transition: transform 0.15s cubic-bezier(0.22,1,0.36,1), box-shadow 0.15s cubic-bezier(0.22,1,0.36,1), background 0.15s; text-decoration: none;
}
.lp-btn-primary { background: ${ACCENT}; color: #fff; box-shadow: 4px 4px 0 ${LINE}; }
.lp-btn-primary:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0 ${LINE}; background: ${ACCENT}; }
.lp-btn-primary:active { transform: translate(0,0); box-shadow: 2px 2px 0 ${LINE}; }
.lp-btn-secondary { background: ${PAPER}; color: ${INK}; box-shadow: 4px 4px 0 ${LINE}; }
.lp-btn-secondary:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0 ${LINE}; }
.lp-btn-secondary:active { transform: translate(0,0); box-shadow: 2px 2px 0 ${LINE}; }
.lp-btn-outline-light { background: transparent; color: ${ON_DARK}; border-color: ${ON_DARK}; }
.lp-btn-outline-light:hover { background: ${ON_DARK}; color: ${DARK}; }
.lp-btn-ghost { background: transparent; color: ${INK}; border-color: transparent; padding: 9px 14px; font-size: 14px; }
.lp-btn-ghost:hover { color: ${ACCENT}; }
.lp-btn-nav { padding: 9px 16px; font-size: 14px; box-shadow: 3px 3px 0 ${LINE}; }
.lp-btn-hero { padding: 14px 26px; font-size: 16px; }

/* Text links (secondary actions) */
.lp-link { background: none; border: none; padding: 0; color: ${ACCENT}; font-weight: 700; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; font-family: var(--font-body); font-size: inherit; }
.lp-link:hover { color: ${INK}; }
.lp-link-light { background: none; border: none; padding: 0; color: ${ON_DARK}; font-weight: 600; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; font-family: var(--font-body); font-size: 15px; opacity: 0.85; }
.lp-link-light:hover { opacity: 1; color: #fff; }
.lp-hero-login { margin-top: 18px; font-size: 15px; color: ${MUTED}; }
.lp-trust { margin-top: 30px; display: flex; gap: 22px; flex-wrap: wrap; justify-content: center; }
.lp-trust span { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: ${MUTED}; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.5px; }
.lp-trust svg { color: ${ACCENT}; flex-shrink: 0; }

/* Demo panel */
.lp-demo-panel { max-width: 760px; margin: 0 auto; text-align: center; background: ${PAPER}; border: 2px solid ${LINE}; box-shadow: 8px 8px 0 ${ACCENT}; padding: clamp(40px, 6vw, 64px) 28px; }
.lp-demo-sub { font-size: clamp(1rem, 2vw, 1.15rem); color: ${MUTED}; max-width: 520px; margin: 14px auto 28px; line-height: 1.6; }
.lp-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border: 1.5px solid ${LINE}; background: ${PAPER}; color: ${INK}; cursor: pointer; transition: background 0.15s; }
.lp-icon-btn:hover { background: ${ACCENT}; color: #fff; }

/* Hero */
.lp-hero { position: relative; min-height: 92vh; display: flex; flex-direction: column; overflow: hidden; }
.lp-grid-bg { position: absolute; inset: 0; pointer-events: none; opacity: 0.5;
  background-image: radial-gradient(${INK} 1.1px, transparent 1.1px); background-size: 26px 26px; -webkit-mask-image: radial-gradient(120% 80% at 50% 0%, #000 30%, transparent 75%); mask-image: radial-gradient(120% 80% at 50% 0%, #000 30%, transparent 75%); }
.lp-hero-inner { position: relative; z-index: 2; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 56px 24px 80px; max-width: 980px; margin: 0 auto; }
.lp-tagline { font-size: clamp(2.4rem, 7vw, 5rem); line-height: 0.98; letter-spacing: -0.035em; margin: 16px 0 18px; }
.lp-tagline-accent { color: ${ACCENT}; }
.lp-subtitle { font-size: clamp(1rem, 2.2vw, 1.25rem); color: ${MUTED}; max-width: 560px; margin: 0 auto 30px; line-height: 1.6; }
.lp-cta-row { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
.lp-hero-welcome { margin: 0; font-size: clamp(1.05rem, 2.4vw, 1.35rem); line-height: 1.5; color: ${MUTED}; }
.lp-hero-welcome strong { font-family: var(--font-display); font-weight: 700; color: ${INK}; letter-spacing: -0.01em; }
.lp-demo-note { margin-top: 14px; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: ${FAINT}; }
.lp-scroll { position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%); color: ${ACCENT}; z-index: 2; animation: lpBounce 1.8s ease-in-out infinite; }
@keyframes lpBounce { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, 10px); } }

/* Sections */
.lp-section { padding: clamp(64px, 9vw, 120px) 24px; }
.lp-section-ink { background: ${DARK}; color: ${ON_DARK}; }
.lp-section-muted { background: var(--bg-muted); border-top: 1.5px solid ${LINE}; border-bottom: 1.5px solid ${LINE}; }
.lp-h2 { font-size: clamp(1.7rem, 4.2vw, 2.8rem); text-align: center; margin: 0 auto; max-width: 800px; line-height: 1.08; }

/* Bento */
.lp-bento { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; max-width: 1140px; margin: 48px auto 0; }
.lp-card { position: relative; height: 100%; background: ${PAPER}; border: 1.5px solid ${LINE}; padding: 22px; transition: transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.18s cubic-bezier(0.22,1,0.36,1); }
.lp-card:hover { transform: translate(-4px,-4px); box-shadow: 7px 7px 0 ${LINE}; }
.lp-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.lp-card-icon { width: 46px; height: 46px; border: 1.5px solid ${LINE}; background: ${BONE}; color: ${ACCENT}; display: flex; align-items: center; justify-content: center; }
.lp-card-num { font-size: 12px; font-weight: 700; color: ${FAINT}; }
.lp-card-title { font-size: 1.15rem; margin: 0 0 7px; }
.lp-card-desc { font-size: 14px; color: ${MUTED}; line-height: 1.6; margin: 0; }
.lp-badge { position: absolute; top: -10px; right: 14px; background: ${ACCENT}; color: #fff; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; padding: 3px 9px; border: 1.5px solid ${LINE}; }

/* Mockup */
.lp-mockup { max-width: 880px; margin: 48px auto 0; }
.lp-browser { background: ${PAPER}; border: 2px solid ${LINE}; box-shadow: 10px 10px 0 ${ACCENT}; overflow: hidden; }
.lp-browser-bar { display: flex; align-items: center; gap: 8px; padding: 11px 14px; background: ${BONE}; border-bottom: 1.5px solid ${LINE}; }
.lp-dot { width: 11px; height: 11px; border: 1.5px solid ${LINE}; background: ${PAPER}; }
.lp-url { margin-left: 12px; font-size: 12px; color: ${INK}; background: ${PAPER}; padding: 4px 12px; border: 1.5px solid ${LINE}; }
.lp-browser-body { padding: 28px; background: radial-gradient(${INK} 1px, transparent 1px); background-size: 22px 22px; background-color: ${BONE}; }
.lp-node { opacity: 0; animation: lpNodeIn 0.5s ease-out forwards; }
@keyframes lpNodeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

/* Steps */
.lp-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 1000px; margin: 52px auto 0; }
.lp-step { position: relative; background: ${PAPER}; border: 1.5px solid ${LINE}; padding: 28px 24px; text-align: left; }
.lp-step-num { font-size: 3.2rem; line-height: 1; color: ${ACCENT}; margin-bottom: 6px; }
.lp-step-icon { width: 48px; height: 48px; border: 1.5px solid ${LINE}; background: ${BONE}; color: ${INK}; display: flex; align-items: center; justify-content: center; margin: 8px 0 16px; }

/* Pricing */
.lp-pricing { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; max-width: 1000px; margin: 52px auto 0; align-items: stretch; }
.lp-plan { position: relative; height: 100%; background: ${PAPER}; border: 2px solid ${LINE}; box-shadow: 4px 4px 0 ${LINE}; padding: 30px 26px; display: flex; flex-direction: column; transition: transform 0.2s cubic-bezier(0.22,1,0.36,1), box-shadow 0.2s cubic-bezier(0.22,1,0.36,1); }
.lp-plan:hover { transform: translateY(-4px); box-shadow: 6px 8px 0 ${LINE}; }
.lp-plan-popular { background: ${ACCENT}; color: #fff; box-shadow: 6px 6px 0 ${LINE}; }
.lp-plan-popular:hover { box-shadow: 8px 10px 0 ${LINE}; }
.lp-plan-badge { position: absolute; top: -12px; left: 26px; background: ${INK}; color: ${BONE}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; padding: 4px 12px; border: 1.5px solid ${LINE}; }
.lp-plan-name { font-size: 1.4rem; margin: 0 0 10px; }
.lp-plan-price { margin-bottom: 20px; display: flex; align-items: baseline; gap: 4px; }
.lp-plan-price span { font-size: 2.6rem; }
.lp-plan-price small { color: ${FAINT}; font-size: 13px; }
.lp-plan-features { list-style: none; padding: 0; margin: 0 0 24px; flex: 1; display: flex; flex-direction: column; gap: 11px; border-top: 1.5px solid ${LINE}; padding-top: 18px; }
.lp-plan-features li { display: flex; gap: 9px; align-items: center; font-size: 14px; color: ${MUTED}; }
.lp-plan-popular .lp-plan-price span, .lp-plan-popular .lp-plan-name { color: #fff; }
.lp-plan-popular .lp-plan-price small { color: rgba(255,255,255,0.85); }
.lp-plan-popular .lp-plan-features { border-top-color: rgba(255,255,255,0.45); }
.lp-plan-popular .lp-plan-features li { color: #fff; }

/* FAQ */
.lp-faq { max-width: 800px; margin: 44px auto 0; border-bottom: 1.5px solid ${LINE}; }

/* CTA banner */
.lp-cta-banner { text-align: center; border-top: 2px solid ${LINE}; }
.lp-cta-title { font-size: clamp(2rem, 5vw, 3.4rem); color: ${ON_DARK}; line-height: 1; }

/* Footer */
.lp-footer { background: #0f0d0b; color: #d8d2c8; padding: 56px 24px 28px; border-top: 2px solid ${ACCENT}; }
.lp-footer-grid { max-width: 1140px; margin: 0 auto; display: flex; justify-content: space-between; gap: 32px; flex-wrap: wrap; padding-bottom: 28px; border-bottom: 1px solid rgba(255,255,255,0.12); }
.lp-footer-links { display: flex; flex-direction: column; gap: 9px; font-size: 14px; }
.lp-footer-links a { color: #b8b2a6; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: color 0.15s; }
.lp-footer-links a:hover { color: ${ACCENT}; }
.lp-foot-h { font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #8a8276; font-weight: 700; margin-bottom: 4px; }
.lp-footer-bottom { max-width: 1140px; margin: 20px auto 0; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 11px; letter-spacing: 0.5px; color: #8a8276; text-transform: uppercase; }

/* Testimonials fade */
.lp-fade { animation: lpFade 0.4s ease-out; }
@keyframes lpFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

@media (max-width: 1024px) { .lp-bento { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px) {
  .lp-bento { grid-template-columns: 1fr; }
  .lp-pricing { grid-template-columns: 1fr; }
  .lp-steps { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .lp-scroll, .lp-node { animation: none !important; }
  .lp-node { opacity: 1; }
}
`;
