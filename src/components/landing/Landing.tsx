'use client';
import { useState, useEffect, useRef } from 'react';
import { GitBranch, BookOpen, Users, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import AuthModal from '@/components/AuthModal';
import LanguageSwitcher from '@/components/LanguageSwitcher';

/* =====================================================================
   Suimini — Landing « Editorial Heritage »
   Un objet éditorial (NYT / Kinfolk / The Gentlewoman), pas une SaaS tech.
   Archival Cream & Gold · Cormorant Garamond + Libre Baskerville.
   Réécrite from scratch. Zéro border-radius, aucune image (SVG + texte).
   ===================================================================== */

const CREAM = '#FBF7EF';
const PANEL = '#F0EBE0';
const PAPER = '#FFFFFF';
const INK = '#1A1714';
const GOLD = '#A36B1E';      // fills / rules
const GOLD_TX = '#7A4E12';   // gold TEXT on light (WCAG AA on cream)
const MUTED = '#6B6358';
const FAINT = '#8A8276';
const LINE = '#E6DECF';
const ON_DARK = '#FBF7EF';
const ON_DARK_MUTED = '#B8B0A2';

/* ---------- Scroll position (nav transparency) ---------- */
function useScrolled(threshold = 24) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

/* ---------- fadeInUp on scroll (IO, reduced-motion aware) ---------- */
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
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.14 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ ...style, opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(30px)', transition: instant ? 'none' : `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms` }}>
      {children}
    </div>
  );
}

/* ---------- Hero illustration : arbre généalogique à l’encre ---------- */
function HeritageTree() {
  const node = (x: number, y: number, name: string, root = false) => (
    <g key={`${x}-${y}`}>
      <circle cx={x} cy={y} r={23} fill={PAPER} stroke={root ? GOLD : INK} strokeWidth={root ? 2 : 1.5} />
      <circle cx={x} cy={y} r={root ? 6 : 4} fill={root ? GOLD : INK} opacity={root ? 1 : 0.6} />
      <text x={x} y={y + 44} textAnchor="middle" fontFamily="var(--font-display)" fontStyle="italic" fontSize="16" fill={INK}>{name}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 480 600" width="100%" role="img" aria-label="Arbre généalogique d’une famille sur trois générations" className="lp-tree">
      <g stroke={INK} strokeWidth="1.4" fill="none" opacity="0.75" strokeLinecap="round">
        {/* gen1 union + drop */}
        <path d="M193 96 H287" />
        <path d="M240 96 V150" />
        {/* gen2 bus + verticals */}
        <path d="M110 150 H370 M110 150 V184 M240 150 V184 M370 150 V184" />
        {/* gen3 under the middle node */}
        <path d="M240 230 V300 M150 300 H330 M150 300 V334 M240 300 V334 M330 300 V334" />
      </g>
      {node(193, 96, 'Augustine', true)}
      {node(287, 96, 'Henri', true)}
      {node(110, 207, 'Marguerite')}
      {node(240, 207, 'Sophie')}
      {node(370, 207, 'Pierre')}
      {node(150, 357, 'Léa')}
      {node(240, 357, 'Hugo')}
      {node(330, 357, 'Emma')}
    </svg>
  );
}

const STATS = [
  { value: '7', label: 'Générations' },
  { value: '58', label: 'Membres Teda' },
  { value: '150+', label: 'Années d’histoire' },
];

const FEATURES = [
  { Icon: GitBranch, title: 'Visualiser', desc: 'Un arbre interactif sur sept générations, aussi clair à lire qu’élégant à contempler. Zoom, fiches, chronologie, carte des origines.' },
  { Icon: BookOpen, title: 'Raconter', desc: 'L’intelligence artificielle compose le récit narratif de votre lignée à partir des dates, des lieux et des liens — la mémoire mise en mots.' },
  { Icon: Users, title: 'Transmettre', desc: 'Invitez vos proches à contribuer en temps réel, exportez un livret PDF, et léguez une histoire qui se conserve, génération après génération.' },
];

export default function Landing() {
  const { startDemo, user, isDemo, isApproved } = useAuth();
  const scrolled = useScrolled();
  const canEnterApp = isDemo || (!!user && isApproved);
  const goToApp = () => { if (typeof window !== 'undefined') window.location.href = '/app'; };
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('signup');
  const openAuth = (tab: 'login' | 'signup') => { setAuthTab(tab); setShowAuth(true); };
  const startSignup = () => openAuth('signup');

  return (
    <div className="lp-root">
      {/* ===================== 1 · NAVIGATION ===================== */}
      <nav className={`lp-nav ${scrolled ? 'lp-nav-scrolled' : ''}`}>
        <a href="#top" className="lp-logo" aria-label="Suimini, accueil">Suimini</a>
        <div className="lp-nav-links">
          <a href="#features">Fonctions</a>
          <a href="#tarifs">Tarifs</a>
          <a href="#faq">FAQ</a>
        </div>
        <button onClick={canEnterApp ? goToApp : () => openAuth('login')} className="lp-nav-cta">
          {canEnterApp ? 'Accéder' : 'Se connecter'} <ArrowRight size={15} aria-hidden="true" />
        </button>
      </nav>

      {/* ===================== 2 · HERO ===================== */}
      <header id="top" className="lp-hero">
        <div className="lp-hero-text">
          <Reveal><div className="lp-kicker">Arbre généalogique · Est. 2026</div></Reveal>
          <Reveal delay={90}>
            <h1 className="lp-title">L’histoire de votre famille,<br /><em>écrite pour toujours.</em></h1>
          </Reveal>
          <Reveal delay={170}><hr className="lp-rule" /></Reveal>
          <Reveal delay={230}>
            <p className="lp-subtitle">Réunissez les vôtres, génération après génération, dans un arbre aussi beau qu’un livre de famille.</p>
          </Reveal>
          <Reveal delay={310}>
            <div className="lp-hero-cta">
              {canEnterApp ? (
                <button onClick={goToApp} className="lp-btn lp-btn-ink">Accéder à l’app <ArrowRight size={17} aria-hidden="true" /></button>
              ) : (
                <button onClick={startSignup} className="lp-btn lp-btn-ink">Commencer — c’est gratuit</button>
              )}
              <button onClick={startDemo} className="lp-textlink">Voir la démo <ArrowRight size={15} aria-hidden="true" /></button>
            </div>
          </Reveal>
        </div>
        <div className="lp-hero-art" aria-hidden={false}>
          <HeritageTree />
        </div>
      </header>

      {/* ===================== 3 · BANDE CHIFFRES (encre) ===================== */}
      <section className="lp-stats">
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 90} style={{ flex: 1 }}>
            <div className={`lp-stat ${i > 0 ? 'lp-stat-div' : ''}`}>
              <div className="lp-stat-num">{s.value}</div>
              <div className="lp-stat-label">{s.label}</div>
            </div>
          </Reveal>
        ))}
      </section>

      {/* ===================== 4 · NARRATIVE ===================== */}
      <section className="lp-narrative">
        <div className="lp-shell">
          <Reveal><div className="lp-kicker lp-kicker-l">La mémoire</div></Reveal>
          <Reveal delay={70}><h2 className="lp-h2 lp-h2-l">Chaque famille a son histoire</h2></Reveal>
          <div className="lp-narr-grid">
            <Reveal delay={120}>
              <div className="lp-narr-text">
                <p className="lp-dropcap">Quelque part, un prénom se transmet depuis cinq générations. Une photographie jaunit dans une boîte. Un métier, un village, une habitude se sont glissés jusqu’à vous sans que vous le sachiez. Tout cela compose une histoire — la vôtre.</p>
                <p>Suimini lui donne une forme digne : un arbre que l’on consulte comme un beau livre, que l’on enrichit à plusieurs, et que l’on transmet intact. Parce qu’une mémoire ne devrait pas tenir dans une boîte à chaussures.</p>
              </div>
            </Reveal>
            <Reveal delay={180}>
              <blockquote className="lp-pullquote">
                « On hérite d’un nom. On choisit d’en faire une histoire. »
              </blockquote>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===================== 5 · FEATURES ===================== */}
      <section id="features" className="lp-features">
        <div className="lp-shell">
          <Reveal><div className="lp-kicker">Ce que vous pouvez faire</div></Reveal>
          <Reveal delay={70}><h2 className="lp-h2">Tout ce dont vous avez besoin</h2></Reveal>
          <div className="lp-feat-grid">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 90} style={{ height: '100%' }}>
                <article className={`lp-feat ${i > 0 ? 'lp-feat-div' : ''}`}>
                  <f.Icon size={30} strokeWidth={1.3} aria-hidden="true" style={{ color: GOLD }} />
                  <h3 className="lp-feat-title">{f.title}</h3>
                  <p className="lp-feat-desc">{f.desc}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== 6 · CTA FINALE (encre) ===================== */}
      <section className="lp-final">
        <Reveal>
          <div className="lp-final-inner">
            <p className="lp-final-quote"><em>« Tant qu’on raconte leur histoire, ceux qu’on aime ne nous quittent jamais tout à fait. »</em></p>
            <p className="lp-final-sign">— Suimini, pour les vôtres</p>
            <button onClick={canEnterApp ? goToApp : startSignup} className="lp-btn lp-btn-cream">
              {canEnterApp ? 'Accéder à l’app' : 'Commencer maintenant'}
            </button>
          </div>
        </Reveal>
      </section>

      {/* ===================== 7 · FOOTER ===================== */}
      <footer className="lp-footer">
        <div className="lp-footer-grid">
          <div className="lp-footer-brand">
            <div className="lp-logo lp-footer-logo">Suimini</div>
            <p className="lp-footer-tag">L’arbre généalogique, comme un livre de famille.</p>
          </div>
          <nav className="lp-footer-col" aria-label="Produit">
            <span className="lp-foot-h">Produit</span>
            <a href="#features">Fonctions</a>
            <button onClick={startDemo} className="lp-foot-linkbtn">Essayer la démo</button>
            <button onClick={canEnterApp ? goToApp : startSignup} className="lp-foot-linkbtn">{canEnterApp ? 'Accéder' : 'Commencer'}</button>
          </nav>
          <nav className="lp-footer-col" aria-label="Légal">
            <span className="lp-foot-h">Légal</span>
            <a href="/cgu">Conditions générales</a>
            <a href="/confidentialite">Confidentialité</a>
            <a href="/cgu">Mentions légales</a>
          </nav>
          <div className="lp-footer-col">
            <span className="lp-foot-h">Langue</span>
            <LanguageSwitcher tone="app" />
          </div>
        </div>
        <div className="lp-footer-bottom">© 2026 Suimini · Fait avec soin en France</div>
      </footer>

      {/* anchors vides — conservés pour ne pas casser les liens de nav (sections retirées) */}
      <span id="tarifs" aria-hidden="true" />
      <span id="faq" aria-hidden="true" />

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} initialTab={authTab} />}

      <style>{LANDING_CSS}</style>
    </div>
  );
}

const LANDING_CSS = `
.lp-root { background: ${CREAM}; color: ${INK}; font-family: var(--font-body); overflow-x: hidden; }

/* ---- 1 · NAV ---- */
.lp-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 50; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 18px 40px; background: transparent; border-bottom: 1px solid transparent; transition: background 0.3s ease, border-color 0.3s ease, padding 0.3s ease; }
.lp-nav-scrolled { background: color-mix(in srgb, ${CREAM} 90%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid ${GOLD}; padding: 12px 40px; }
.lp-logo { font-family: var(--font-display); font-style: italic; font-weight: 500; font-size: 26px; letter-spacing: -0.01em; color: ${INK}; text-decoration: none; }
.lp-nav-links { display: flex; gap: 32px; }
.lp-nav-links a { font-family: var(--font-body); font-size: 15px; color: ${INK}; text-decoration: none; transition: color 0.15s; }
.lp-nav-links a:hover { color: ${GOLD_TX}; }
.lp-nav-cta { background: none; border: none; cursor: pointer; font-family: var(--font-body); font-weight: 700; font-size: 15px; color: ${GOLD_TX}; display: inline-flex; align-items: center; gap: 6px; padding: 4px; transition: gap 0.2s ease; }
.lp-nav-cta:hover { gap: 10px; }
@media (max-width: 820px) { .lp-nav-links { display: none; } .lp-nav, .lp-nav-scrolled { padding-left: 24px; padding-right: 24px; } }

/* ---- Buttons / links ---- */
.lp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; cursor: pointer; font-family: var(--font-body); font-weight: 700; font-size: 16px; border-radius: 0; padding: 15px 30px; border: 1px solid transparent; transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.12s ease; text-decoration: none; line-height: 1.2; }
.lp-btn:active { transform: translateY(1px); }
.lp-btn-ink { background: ${INK}; color: ${ON_DARK}; border-color: ${INK}; }
.lp-btn-ink:hover { background: #000; box-shadow: 0 8px 24px rgba(26,23,20,0.22); }
.lp-btn-cream { background: ${CREAM}; color: ${INK}; border-color: ${CREAM}; }
.lp-btn-cream:hover { background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
.lp-textlink { background: none; border: none; cursor: pointer; font-family: var(--font-body); font-weight: 700; font-size: 16px; color: ${GOLD_TX}; display: inline-flex; align-items: center; gap: 7px; padding: 4px; transition: gap 0.2s ease; }
.lp-textlink:hover { gap: 11px; color: ${INK}; }

/* ---- Shared ---- */
.lp-shell { max-width: 1180px; margin: 0 auto; padding: 0 40px; }
.lp-kicker { font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 2.5px; font-size: 11px; font-weight: 500; color: ${GOLD_TX}; }
.lp-h2 { font-family: var(--font-display); font-weight: 600; font-size: clamp(2rem, 4.4vw, 3.2rem); line-height: 1.08; letter-spacing: -0.01em; text-align: center; margin: 14px auto 0; max-width: 18ch; }
.lp-kicker-l, .lp-h2-l { text-align: left; margin-left: 0; }

/* ---- 2 · HERO ---- */
.lp-hero { display: grid; grid-template-columns: 60fr 40fr; min-height: 100vh; min-height: 100dvh; }
.lp-hero-text { background: ${CREAM}; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding: 120px 64px 80px; }
.lp-title { font-family: var(--font-display); font-weight: 700; font-size: clamp(2.8rem, 5.2vw, 5.2rem); line-height: 1.0; letter-spacing: -0.02em; margin: 22px 0 0; color: ${INK}; }
.lp-title em { font-style: italic; color: ${INK}; }
.lp-rule { width: 80px; height: 2px; background: ${GOLD}; border: none; margin: 28px 0 0; }
.lp-subtitle { font-family: var(--font-body); font-size: clamp(1.05rem, 1.5vw, 1.3rem); line-height: 1.65; color: ${MUTED}; max-width: 42ch; margin: 26px 0 0; }
.lp-hero-cta { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; margin: 38px 0 0; }
.lp-hero-art { background: ${PANEL}; border-left: 1px solid ${LINE}; display: flex; align-items: center; justify-content: center; padding: 64px 48px; }
.lp-tree { max-width: 460px; width: 100%; }
@media (max-width: 920px) {
  .lp-hero { grid-template-columns: 1fr; min-height: 0; }
  .lp-hero-text { padding: 130px 28px 56px; }
  .lp-hero-art { border-left: none; border-top: 1px solid ${LINE}; padding: 48px 28px; }
  .lp-tree { max-width: 360px; }
}

/* ---- 3 · STATS (encre) ---- */
.lp-stats { background: ${INK}; color: ${ON_DARK}; display: flex; padding: 60px 40px; max-width: 100%; }
.lp-stat { text-align: center; padding: 8px 16px; }
.lp-stat-div { border-left: 1px solid ${GOLD}; }
.lp-stat-num { font-family: var(--font-display); font-weight: 600; font-size: clamp(3.2rem, 7vw, 5rem); line-height: 1; color: ${ON_DARK}; letter-spacing: -0.01em; }
.lp-stat-label { font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 2px; font-size: 11px; color: ${ON_DARK_MUTED}; margin-top: 16px; }
@media (max-width: 720px) { .lp-stats { flex-direction: column; gap: 36px; padding: 48px 24px; } .lp-stat-div { border-left: none; border-top: 1px solid ${GOLD}; padding-top: 36px; } }

/* ---- 4 · NARRATIVE ---- */
.lp-narrative { background: ${CREAM}; padding: clamp(72px, 10vw, 128px) 0; }
.lp-narr-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: clamp(40px, 6vw, 80px); align-items: start; margin-top: 44px; }
.lp-narr-text p { font-family: var(--font-body); font-size: 1.1rem; line-height: 1.85; color: ${INK}; margin: 0 0 22px; max-width: 56ch; }
.lp-narr-text p:last-child { color: ${MUTED}; margin-bottom: 0; }
.lp-dropcap::first-letter { font-family: var(--font-display); font-weight: 600; font-size: 3.6em; line-height: 0.72; float: left; margin: 0.05em 0.10em 0 0; color: ${GOLD}; }
.lp-pullquote { font-family: var(--font-display); font-style: italic; font-weight: 500; font-size: clamp(1.6rem, 2.8vw, 2.2rem); line-height: 1.32; color: ${INK}; border-left: 3px solid ${GOLD}; padding-left: 26px; margin: 6px 0 0; }
@media (max-width: 820px) { .lp-narr-grid { grid-template-columns: 1fr; gap: 40px; } }

/* ---- 5 · FEATURES (blanc) ---- */
.lp-features { background: ${PAPER}; border-top: 1px solid ${LINE}; border-bottom: 1px solid ${LINE}; padding: clamp(72px, 10vw, 128px) 0; }
.lp-feat-grid { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 56px; border-top: 1px solid ${LINE}; }
.lp-feat { height: 100%; padding: 44px 36px; display: flex; flex-direction: column; transition: background 0.25s ease; }
.lp-feat-div { border-left: 1px solid ${GOLD}; }
.lp-feat:hover { background: ${CREAM}; }
.lp-feat-title { font-family: var(--font-display); font-weight: 600; font-size: 1.9rem; letter-spacing: -0.01em; margin: 20px 0 0; }
.lp-feat-title::after { content: ''; display: block; width: 34px; height: 2px; background: ${GOLD}; margin: 14px 0 0; }
.lp-feat-desc { font-family: var(--font-body); font-size: 15px; line-height: 1.75; color: ${MUTED}; margin: 18px 0 0; }
@media (max-width: 820px) {
  .lp-feat-grid { grid-template-columns: 1fr; }
  .lp-feat-div { border-left: none; border-top: 1px solid ${GOLD}; }
}

/* ---- 6 · FINAL CTA (encre) ---- */
.lp-final { background: ${INK}; color: ${ON_DARK}; padding: clamp(88px, 13vw, 160px) 24px; text-align: center; }
.lp-final-inner { max-width: 800px; margin: 0 auto; }
.lp-final-quote { font-family: var(--font-display); font-weight: 500; font-size: clamp(1.7rem, 3.6vw, 2.5rem); line-height: 1.32; color: ${ON_DARK}; margin: 0; }
.lp-final-sign { font-family: var(--font-display); font-style: italic; font-size: 1.05rem; color: ${GOLD}; margin: 26px 0 0; opacity: 0.92; }
.lp-final .lp-btn { margin-top: 40px; }

/* ---- 7 · FOOTER ---- */
.lp-footer { background: ${CREAM}; color: ${INK}; border-top: 2px solid ${GOLD}; padding: 64px 40px 32px; }
.lp-footer-grid { max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; padding-bottom: 30px; border-bottom: 1px solid ${LINE}; }
.lp-footer-logo { font-size: 28px; }
.lp-footer-tag { font-family: var(--font-body); font-size: 14px; color: ${MUTED}; line-height: 1.7; margin: 12px 0 0; max-width: 280px; }
.lp-footer-col { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
.lp-foot-h { font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 1.5px; font-size: 11px; color: ${FAINT}; }
.lp-footer-col a, .lp-foot-linkbtn { font-family: var(--font-body); font-size: 15px; color: ${MUTED}; text-decoration: none; background: none; border: none; padding: 0; cursor: pointer; text-align: left; transition: color 0.15s; }
.lp-footer-col a:hover, .lp-foot-linkbtn:hover { color: ${GOLD_TX}; }
.lp-footer-bottom { max-width: 1180px; margin: 22px auto 0; font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: ${FAINT}; }
@media (max-width: 820px) {
  .lp-footer-grid { grid-template-columns: 1fr 1fr; gap: 32px; }
  .lp-footer-brand { grid-column: 1 / -1; }
}
`;
