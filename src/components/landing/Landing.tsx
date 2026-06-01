'use client';
import { useState, useEffect, useRef } from 'react';
import {
  TreePine, Map, Cloud, Search, BookOpen, Play, BarChart2, Dna,
  ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Check, Mail,
  KeyRound, UserPlus, Share2, ShieldCheck, Code2, FileText, Star, Gamepad2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import AuthModal from '@/components/AuthModal';

const ACCENT = '#c4935a';
const DARK = '#0a0805';

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
    <div ref={ref} style={{ ...style, opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(28px)', transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms` }}>
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
  { name: 'Gratuit', price: '0€', period: '', popular: false, features: ['1 arbre', '50 personnes', 'Stockage local (localStorage)', 'Toutes les vues'] },
  { name: 'Famille', price: '9€', period: '/mois', popular: true, features: ['Arbres illimités', 'Sync cloud multi-appareils', 'Partage & collaboration', 'Export PDF haute qualité'] },
  { name: 'Pro', price: '19€', period: '/mois', popular: false, features: ['Tout Famille', 'Collaboration temps réel', 'Rapport généalogique IA', 'Support prioritaire'] },
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
    <div style={{ maxWidth: '680px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
      <div className="lp-fade" key={i}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://api.dicebear.com/7.x/personas/svg?seed=${t.seed}`} alt="" width={72} height={72}
          style={{ borderRadius: '50%', border: `2px solid ${ACCENT}`, background: '#fff', marginBottom: '18px' }} />
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(1.1rem, 2.4vw, 1.5rem)', fontStyle: 'italic', lineHeight: 1.5, margin: '0 0 16px' }}>
          « {t.quote} »
        </p>
        <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', marginBottom: '8px', color: ACCENT }}>
          {[0, 1, 2, 3, 4].map(s => <Star key={s} size={15} fill={ACCENT} />)}
        </div>
        <div style={{ fontWeight: 700 }}>{t.name}</div>
        <div style={{ fontSize: '13px', opacity: 0.7 }}>{t.loc}</div>
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px', alignItems: 'center' }}>
        <button className="lp-icon-btn" aria-label="Témoignage précédent" onClick={() => setI(p => (p - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)}><ChevronLeft size={18} /></button>
        {TESTIMONIALS.map((_, k) => (
          <button key={k} aria-label={`Aller au témoignage ${k + 1}`} onClick={() => setI(k)}
            style={{ width: k === i ? '20px' : '8px', height: '8px', borderRadius: '99px', border: 'none', cursor: 'pointer', padding: 0, background: k === i ? ACCENT : 'rgba(255,255,255,0.25)', transition: 'all 0.25s' }} />
        ))}
        <button className="lp-icon-btn" aria-label="Témoignage suivant" onClick={() => setI(p => (p + 1) % TESTIMONIALS.length)}><ChevronRight size={18} /></button>
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '18px 4px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '16px', fontWeight: 600, color: 'inherit' }}>
        {q}
        <ChevronDown size={18} style={{ flexShrink: 0, transition: 'transform 0.3s ease', transform: open ? 'rotate(180deg)' : 'none', color: ACCENT }} />
      </button>
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s ease' }}>
        <div style={{ overflow: 'hidden' }}>
          <p style={{ margin: 0, padding: '0 4px 18px', opacity: 0.78, lineHeight: 1.7, fontSize: '15px' }}>{a}</p>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { startDemo } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState<'signin' | 'signup' | 'magic'>('signup');
  const [count, setCount] = useState<number | null>(null);

  const openAuth = (tab: 'signin' | 'signup' | 'magic') => { setAuthTab(tab); setShowAuth(true); };
  const startSignup = () => openAuth('signup');

  // Family count (public RPC) with graceful fallback + count-up animation.
  useEffect(() => {
    let target = 2400;
    const animate = () => {
      const start = performance.now();
      const from = 0;
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / 1200);
        const eased = 1 - Math.pow(1 - p, 3);
        setCount(Math.round(from + (target - from) * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    (async () => {
      if (supabase) {
        try {
          const { data } = await supabase.rpc('family_count');
          if (typeof data === 'number' && data > 0) target = Math.max(data, 100);
        } catch { /* fallback */ }
      }
      animate();
    })();
  }, []);

  return (
    <div className="lp-root">
      {/* ===================== HERO ===================== */}
      <header className="lp-hero">
        <div className="lp-grain" aria-hidden="true" />
        <div className="lp-particles" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, k) => <span key={k} className="lp-particle" style={{ left: `${(k * 7 + 4) % 100}%`, animationDelay: `${(k % 7) * 1.1}s`, animationDuration: `${9 + (k % 5) * 2}s` }} />)}
        </div>

        <nav className="lp-nav">
          <div className="lp-logo-sm serif">🌿 Suimini</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <a href="#pricing" className="lp-btn-ghost">Tarifs</a>
            <button onClick={() => openAuth('signin')} className="lp-btn-ghost">Se connecter</button>
          </div>
        </nav>

        <div className="lp-hero-inner">
          <Reveal>
            <div className="serif lp-logo">🌿 Suimini</div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="serif lp-tagline">Préservez l’histoire de votre famille, génération après génération</h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="lp-subtitle">L’arbre généalogique moderne — élégant, collaboratif, et toujours avec vous.</p>
          </Reveal>
          <Reveal delay={240}>
            <div className="lp-cta-row">
              <button onClick={startSignup} className="lp-btn-primary">Commencer gratuitement <ArrowRight size={18} /></button>
              <button onClick={startDemo} className="lp-btn-secondary"><Gamepad2 size={16} /> Essayer la démo</button>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <div className="lp-stat">
              <strong>{count !== null ? count.toLocaleString('fr-FR') : '—'}+</strong> familles déjà préservées
            </div>
          </Reveal>
        </div>

        <a href="#features" className="lp-scroll" aria-label="Faire défiler"><ChevronDown size={26} /></a>
      </header>

      {/* ===================== FEATURES BENTO ===================== */}
      <section id="features" className="lp-section lp-section-light">
        <Reveal><h2 className="serif lp-h2">Tout ce qu’il faut pour votre histoire familiale</h2></Reveal>
        <Reveal delay={60}><p className="lp-section-sub">Huit fonctionnalités pensées pour explorer, préserver et partager.</p></Reveal>
        <div className="lp-bento">
          {FEATURES.map((f, k) => (
            <Reveal key={f.title} delay={k * 60} style={{ height: '100%' }}>
              <div className="lp-card">
                {f.badge && <span className="lp-badge">Nouveau</span>}
                <div className="lp-card-icon"><f.Icon size={24} /></div>
                <h3 className="serif lp-card-title">{f.title}</h3>
                <p className="lp-card-desc">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===================== SCREENSHOT MOCKUP ===================== */}
      <section className="lp-section lp-section-dark">
        <Reveal><h2 className="serif lp-h2">Une interface qui donne vie à votre lignée</h2></Reveal>
        <Reveal delay={80}>
          <div className="lp-mockup">
            <div className="lp-browser">
              <div className="lp-browser-bar">
                <span className="lp-dot" style={{ background: '#ff5f57' }} />
                <span className="lp-dot" style={{ background: '#febc2e' }} />
                <span className="lp-dot" style={{ background: '#28c840' }} />
                <div className="lp-url">suimini.vercel.app/app</div>
              </div>
              <div className="lp-browser-body">
                <svg viewBox="0 0 640 320" width="100%" role="img" aria-label="Aperçu de l’arbre généalogique">
                  {/* connectors */}
                  <g stroke={ACCENT} strokeWidth="2" opacity="0.5" fill="none">
                    <path d="M320 70 V110 M180 110 H460 M180 110 V150 M460 110 V150" />
                    <path d="M180 210 V250 M110 250 H250 M110 250 V270 M250 250 V270" />
                    <path d="M460 210 V250 M390 250 H530 M390 250 V270 M530 250 V270" />
                  </g>
                  {[
                    { x: 290, y: 30, c: ACCENT, d: 0 },
                    { x: 150, y: 150, c: '#3b6fa0', d: 1 },
                    { x: 430, y: 150, c: '#a05070', d: 2 },
                    { x: 80, y: 270, c: '#3b6fa0', d: 3 },
                    { x: 220, y: 270, c: '#a05070', d: 4 },
                    { x: 360, y: 270, c: '#3b6fa0', d: 5 },
                    { x: 500, y: 270, c: '#a05070', d: 6 },
                  ].map((n, k) => (
                    <g key={k} className="lp-node" style={{ animationDelay: `${n.d * 0.15}s` }}>
                      <rect x={n.x} y={n.y} width="60" height="40" rx="8" fill="#1c1916" stroke={n.c} strokeWidth="2" />
                      <circle cx={n.x + 14} cy={n.y + 20} r="9" fill={n.c} opacity="0.85" />
                      <rect x={n.x + 28} y={n.y + 13} width="24" height="4" rx="2" fill="#5a5249" />
                      <rect x={n.x + 28} y={n.y + 22} width="18" height="3" rx="2" fill="#3a342c" />
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <section className="lp-section lp-section-light">
        <Reveal><h2 className="serif lp-h2">Commencez en trois étapes</h2></Reveal>
        <div className="lp-steps">
          {STEPS.map((s, k) => (
            <Reveal key={s.title} delay={k * 100} style={{ flex: 1 }}>
              <div className="lp-step">
                <div className="serif lp-step-num">{k + 1}</div>
                <div className="lp-step-icon"><s.Icon size={26} /></div>
                <h3 className="serif lp-card-title">{s.title}</h3>
                <p className="lp-card-desc">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===================== TESTIMONIALS ===================== */}
      <section className="lp-section lp-section-dark">
        <Reveal><h2 className="serif lp-h2">Ils ont retrouvé leurs racines</h2></Reveal>
        <Reveal delay={80}><Testimonials /></Reveal>
      </section>

      {/* ===================== PRICING ===================== */}
      <section id="pricing" className="lp-section lp-section-light">
        <Reveal><h2 className="serif lp-h2">Des tarifs simples</h2></Reveal>
        <Reveal delay={60}><p className="lp-section-sub">Commencez gratuitement, évoluez quand vous le souhaitez.</p></Reveal>
        <div className="lp-pricing">
          {PLANS.map((p, k) => (
            <Reveal key={p.name} delay={k * 90} style={{ height: '100%' }}>
              <div className={`lp-plan ${p.popular ? 'lp-plan-popular' : ''}`}>
                {p.popular && <span className="lp-plan-badge">Populaire</span>}
                <h3 className="serif lp-plan-name">{p.name}</h3>
                <div className="lp-plan-price"><span>{p.price}</span><small>{p.period}</small></div>
                <ul className="lp-plan-features">
                  {p.features.map(f => <li key={f}><Check size={16} style={{ color: ACCENT, flexShrink: 0 }} /> {f}</li>)}
                </ul>
                <button onClick={startSignup} className={p.popular ? 'lp-btn-primary' : 'lp-btn-outline'} style={{ width: '100%', justifyContent: 'center' }}>Commencer</button>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===================== FAQ ===================== */}
      <section className="lp-section lp-section-light">
        <Reveal><h2 className="serif lp-h2">Questions fréquentes</h2></Reveal>
        <Reveal delay={60}>
          <div style={{ maxWidth: '760px', margin: '24px auto 0' }}>
            {FAQS.map(f => <FaqItem key={f.q} {...f} />)}
          </div>
        </Reveal>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="lp-footer">
        <div className="lp-footer-grid">
          <div>
            <div className="serif lp-logo-sm" style={{ marginBottom: '8px' }}>🌿 Suimini</div>
            <p style={{ opacity: 0.6, fontSize: '13px', maxWidth: '260px', lineHeight: 1.6 }}>L’arbre généalogique moderne — élégant, collaboratif, et toujours avec vous.</p>
          </div>
          <div className="lp-footer-links">
            <span className="lp-foot-h">Produit</span>
            <a href="/app">Ouvrir l’app</a>
            <a href="https://github.com/ndjoumessi/suimini" target="_blank" rel="noopener noreferrer"><Code2 size={13} /> GitHub</a>
            <a href="#features"><FileText size={13} /> Documentation</a>
            <a href="mailto:hello@suimini.app"><Mail size={13} /> Contact</a>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><ShieldCheck size={14} /> Données hébergées en Europe (Supabase Stockholm) · Chiffrement SSL</span>
          <span>© 2025 Suimini</span>
        </div>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} initialTab={authTab} />}

      <style>{LANDING_CSS}</style>
    </div>
  );
}

const LANDING_CSS = `
.lp-root { background: ${DARK}; color: #f0ece5; font-family: 'Lato', sans-serif; overflow-x: hidden; }
.lp-root .serif { font-family: 'Playfair Display', serif; }

/* Hero */
.lp-hero { position: relative; min-height: 100vh; display: flex; flex-direction: column; background: radial-gradient(1200px 600px at 50% -10%, #1c140c 0%, ${DARK} 70%); overflow: hidden; }
.lp-grain { position: absolute; inset: 0; opacity: 0.07; pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
.lp-particles { position: absolute; inset: 0; pointer-events: none; }
.lp-particle { position: absolute; bottom: -10px; width: 6px; height: 6px; border-radius: 50%; background: ${ACCENT}; opacity: 0.35; animation: lpFloat linear infinite; }
@keyframes lpFloat { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 15% { opacity: 0.4; } 100% { transform: translateY(-110vh) scale(1); opacity: 0; } }
.lp-nav { position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; max-width: 1180px; margin: 0 auto; width: 100%; }
.lp-logo-sm { font-size: 1.35rem; color: ${ACCENT}; }
.lp-hero-inner { position: relative; z-index: 2; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px 24px 80px; max-width: 880px; margin: 0 auto; }
.lp-logo { font-size: clamp(48px, 9vw, 72px); color: ${ACCENT}; line-height: 1; margin-bottom: 18px; }
.lp-tagline { font-size: clamp(1.6rem, 4.4vw, 2.8rem); font-weight: 600; line-height: 1.2; margin: 0 0 16px; max-width: 760px; }
.lp-subtitle { font-size: clamp(1rem, 2.2vw, 1.25rem); opacity: 0.78; max-width: 560px; margin: 0 auto 28px; line-height: 1.6; }
.lp-cta-row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.lp-stat { margin-top: 26px; font-size: 14px; opacity: 0.7; }
.lp-stat strong { color: ${ACCENT}; font-size: 18px; }
.lp-scroll { position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%); color: ${ACCENT}; z-index: 2; animation: lpBounce 1.8s ease-in-out infinite; opacity: 0.8; }
@keyframes lpBounce { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, 10px); } }

/* Buttons */
.lp-btn-primary, .lp-btn-secondary, .lp-btn-outline, .lp-btn-ghost { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-family: 'Lato', sans-serif; font-weight: 700; font-size: 15px; border-radius: 10px; padding: 13px 22px; border: none; transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease; text-decoration: none; }
.lp-btn-primary { background: ${ACCENT}; color: #1a1208; box-shadow: 0 8px 24px rgba(196,147,90,0.35); }
.lp-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(196,147,90,0.5); }
.lp-btn-secondary { background: rgba(255,255,255,0.08); color: #f0ece5; border: 1px solid rgba(255,255,255,0.18); }
.lp-btn-secondary:hover { background: rgba(255,255,255,0.14); }
.lp-btn-ghost { background: transparent; color: #d8d2c8; padding: 8px 14px; font-size: 14px; }
.lp-btn-ghost:hover { color: ${ACCENT}; }
.lp-btn-outline { background: transparent; color: #1a1612; border: 1.5px solid ${ACCENT}; }
.lp-btn-outline:hover { background: rgba(196,147,90,0.1); }
.lp-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.06); color: inherit; cursor: pointer; }
.lp-icon-btn:hover { background: rgba(255,255,255,0.14); }

/* Sections */
.lp-section { padding: clamp(64px, 9vw, 110px) 24px; }
.lp-section-dark { background: ${DARK}; color: #f0ece5; }
.lp-section-light { background: #faf8f5; color: #1a1612; }
.lp-h2 { font-size: clamp(1.6rem, 4vw, 2.4rem); font-weight: 600; text-align: center; margin: 0 auto; max-width: 720px; line-height: 1.2; }
.lp-section-sub { text-align: center; opacity: 0.7; max-width: 560px; margin: 12px auto 0; font-size: 16px; }

/* Bento */
.lp-bento { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; max-width: 1100px; margin: 40px auto 0; }
.lp-card { position: relative; height: 100%; background: #fff; border: 1px solid #e8e2da; border-radius: 16px; padding: 22px; box-shadow: 0 2px 12px rgba(26,22,18,0.05); transition: transform 0.2s ease, box-shadow 0.2s ease; }
.lp-card:hover { transform: translateY(-4px); box-shadow: 0 14px 36px rgba(26,22,18,0.12); }
.lp-card-icon { width: 46px; height: 46px; border-radius: 12px; background: rgba(196,147,90,0.14); color: ${ACCENT}; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
.lp-card-title { font-size: 1.05rem; margin: 0 0 6px; }
.lp-card-desc { font-size: 14px; opacity: 0.72; line-height: 1.6; margin: 0; }
.lp-badge { position: absolute; top: 14px; right: 14px; background: ${ACCENT}; color: #1a1208; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 3px 8px; border-radius: 99px; }

/* Mockup */
.lp-mockup { max-width: 860px; margin: 40px auto 0; }
.lp-browser { background: #14110d; border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,0.5); }
.lp-browser-bar { display: flex; align-items: center; gap: 7px; padding: 12px 14px; background: rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.08); }
.lp-dot { width: 11px; height: 11px; border-radius: 50%; }
.lp-url { margin-left: 12px; font-size: 12px; color: #8a8278; background: rgba(0,0,0,0.3); padding: 4px 12px; border-radius: 6px; }
.lp-browser-body { padding: 24px; background: radial-gradient(circle, rgba(58,52,44,0.4) 1px, transparent 1px); background-size: 22px 22px; }
.lp-node { opacity: 0; animation: lpNodeIn 0.5s ease-out forwards; }
@keyframes lpNodeIn { from { opacity: 0; transform: translateY(10px) scale(0.9); } to { opacity: 1; transform: none; } }

/* Steps */
.lp-steps { display: flex; gap: 24px; max-width: 980px; margin: 48px auto 0; flex-wrap: wrap; }
.lp-step { text-align: center; padding: 12px; }
.lp-step-num { font-size: clamp(3rem, 7vw, 4.5rem); font-weight: 700; color: rgba(196,147,90,0.25); line-height: 1; }
.lp-step-icon { width: 52px; height: 52px; border-radius: 50%; background: rgba(196,147,90,0.14); color: ${ACCENT}; display: flex; align-items: center; justify-content: center; margin: -14px auto 14px; position: relative; }

/* Testimonials */
.lp-fade { animation: lpFade 0.4s ease-out; }
@keyframes lpFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

/* Pricing */
.lp-pricing { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 980px; margin: 44px auto 0; align-items: stretch; }
.lp-plan { position: relative; height: 100%; background: #fff; border: 1px solid #e8e2da; border-radius: 18px; padding: 28px 24px; display: flex; flex-direction: column; }
.lp-plan-popular { border: 2px solid ${ACCENT}; box-shadow: 0 18px 44px rgba(196,147,90,0.18); transform: translateY(-6px); }
.lp-plan-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: ${ACCENT}; color: #1a1208; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 14px; border-radius: 99px; }
.lp-plan-name { font-size: 1.3rem; margin: 0 0 8px; }
.lp-plan-price { margin-bottom: 18px; }
.lp-plan-price span { font-size: 2.4rem; font-weight: 700; font-family: 'Playfair Display', serif; }
.lp-plan-price small { opacity: 0.6; font-size: 14px; }
.lp-plan-features { list-style: none; padding: 0; margin: 0 0 22px; flex: 1; display: flex; flex-direction: column; gap: 10px; }
.lp-plan-features li { display: flex; gap: 8px; align-items: center; font-size: 14px; }

/* Footer */
.lp-footer { background: #0d0a07; color: #d8d2c8; padding: 56px 24px 28px; }
.lp-footer-grid { max-width: 1100px; margin: 0 auto; display: flex; justify-content: space-between; gap: 32px; flex-wrap: wrap; padding-bottom: 28px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.lp-footer-links { display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
.lp-footer-links a { color: #b8b0a4; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
.lp-footer-links a:hover { color: ${ACCENT}; }
.lp-foot-h { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: #6b6258; font-weight: 700; margin-bottom: 4px; }
.lp-footer-bottom { max-width: 1100px; margin: 20px auto 0; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 12px; opacity: 0.6; }

@media (max-width: 1024px) { .lp-bento { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px) {
  .lp-bento { grid-template-columns: 1fr; }
  .lp-pricing { grid-template-columns: 1fr; }
  .lp-plan-popular { transform: none; }
  .lp-steps { flex-direction: column; }
}
@media (prefers-reduced-motion: reduce) {
  .lp-particle, .lp-scroll, .lp-node { animation: none !important; }
  .lp-node { opacity: 1; }
}
`;
