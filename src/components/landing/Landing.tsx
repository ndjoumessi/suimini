'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Spectral } from 'next/font/google';
import { useLocale } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import AuthModal from '@/components/AuthModal';
import { LOCALE_COOKIE, LOCALES, type Locale } from '@/i18n/config';

/* =====================================================================
   Suimini — Landing « La constellation des vôtres »
   Drenched midnight. Chaque ancêtre une étoile, chaque lien une ligne de
   lumière. Une seule famille typographique (Spectral), accent ambre chaud.
   Réécrite from scratch. Scopée à la landing (aucun token global modifié).
   ===================================================================== */

const serif = Spectral({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--lp-serif',
  display: 'swap',
});

/* ---------- Reduced motion (read once) ---------- */
function prefersReduced() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ---------- Scroll state (nav) ---------- */
function useScrolled(threshold = 16) {
  const [s, setS] = useState(false);
  useEffect(() => {
    const on = () => setS(window.scrollY > threshold);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [threshold]);
  return s;
}

/* ---------- Reveal: visible-by-default + replay on view (skill-safe) ---------- */
function Reveal({ children, delay = 0, as = 'div', className = '', style }: { children: React.ReactNode; delay?: number; as?: 'div' | 'section' | 'li'; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (prefersReduced()) { setSeen(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    const t = window.setTimeout(() => setSeen(true), 1600); // fallback: never stay hidden
    return () => { io.disconnect(); clearTimeout(t); };
  }, []);
  const Tag = as as React.ElementType;
  return (
    <Tag ref={ref} className={`lp-rv ${seen ? 'lp-rv-in' : ''} ${className}`} style={{ ...style, transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

/* ---------- Locale toggle (dark) ---------- */
function LangToggle() {
  const locale = useLocale();
  const choose = (next: Locale) => {
    if (next === locale) return;
    try { localStorage.setItem(LOCALE_COOKIE, next); } catch { /* ignore */ }
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };
  return (
    <div className="lp-lang" role="group" aria-label="Langue">
      {LOCALES.map((l) => (
        <button key={l} type="button" onClick={() => choose(l)} aria-pressed={l === locale} aria-label={l === 'fr' ? 'Français' : 'English'} className={l === locale ? 'lp-lang-on' : ''}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/* ---------- Constellation data ---------- */
// Named family stars (viewBox 0 0 1000 660). bright = root couple.
const KIN = [
  { x: 392, y: 150, name: 'Augustine', bright: true },
  { x: 548, y: 124, name: 'Henri', bright: true },
  { x: 250, y: 330, name: 'Marguerite' },
  { x: 478, y: 312, name: 'Sophie' },
  { x: 720, y: 344, name: 'Pierre' },
  { x: 318, y: 510, name: 'Léa' },
  { x: 486, y: 528, name: 'Hugo' },
  { x: 658, y: 506, name: 'Emma' },
];
// Connector paths between generations (ink-light lines of light).
const PATHS = [
  'M392 150 L548 124',                                   // gen1 union
  'M470 137 L470 220 M250 220 L720 220 M250 220 L250 312 M470 220 L470 312 M720 220 L720 344', // bus to gen2
  'M478 312 L478 420 M318 420 L658 420 M318 420 L318 510 M486 420 L486 528 M658 420 L658 506', // bus to gen3
];
// Ambient field stars (percent coords), curated for a calm scatter.
const FIELD = [
  [6, 18, 1.4, 0.7], [14, 64, 1, 0.5], [9, 86, 1.6, 0.6], [21, 32, 1, 0.45], [27, 78, 1.3, 0.7],
  [34, 12, 1, 0.5], [38, 52, 1.5, 0.6], [44, 88, 1, 0.4], [52, 22, 1.2, 0.6], [58, 70, 1, 0.5],
  [63, 40, 1.5, 0.7], [69, 14, 1, 0.45], [73, 84, 1.3, 0.6], [79, 56, 1, 0.5], [84, 28, 1.5, 0.7],
  [88, 74, 1.1, 0.55], [92, 44, 1, 0.5], [96, 16, 1.4, 0.65], [3, 46, 1, 0.4], [48, 8, 1, 0.5],
  [17, 6, 1.2, 0.6], [31, 94, 1, 0.45], [66, 92, 1.2, 0.55], [82, 6, 1, 0.5], [97, 90, 1.3, 0.6],
  [11, 38, 0.9, 0.4], [55, 48, 0.9, 0.45], [76, 36, 0.9, 0.4], [42, 70, 0.9, 0.5], [24, 56, 0.9, 0.45],
] as const;

function Constellation() {
  return (
    <svg className="lp-sky-svg" viewBox="0 0 1000 660" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="lp-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e7b45c" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#e7b45c" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#e7b45c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lp-neb" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3a2f4d" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#3a2f4d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lp-neb2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7a5a2e" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#7a5a2e" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* nebulae */}
      <ellipse className="lp-neb lp-neb-a" cx="320" cy="240" rx="520" ry="380" fill="url(#lp-neb)" />
      <ellipse className="lp-neb lp-neb-b" cx="760" cy="430" rx="460" ry="340" fill="url(#lp-neb2)" />

      {/* ambient field (parallax: far layer) */}
      <g className="lp-far">
        {FIELD.map(([px, py, r, o], i) => (
          <circle key={i} className="lp-amb" cx={px * 10} cy={py * 6.6} r={r} fill="#f2eee4" opacity={o} style={{ animationDelay: `${(i % 7) * 0.5}s`, '--o': o } as React.CSSProperties} />
        ))}
      </g>

      {/* connectors */}
      <g className="lp-near" fill="none" stroke="#e7b45c" strokeWidth="1" strokeLinecap="round">
        {PATHS.map((d, i) => (
          <path key={i} className="lp-link" d={d} pathLength={1} style={{ animationDelay: `${0.4 + i * 0.25}s` }} />
        ))}
      </g>

      {/* named kin stars */}
      <g className="lp-near">
        {KIN.map((k, i) => (
          <g key={k.name} className="lp-kin" style={{ animationDelay: `${0.7 + i * 0.12}s` }}>
            <circle cx={k.x} cy={k.y} r={k.bright ? 26 : 20} fill="url(#lp-halo)" />
            <circle cx={k.x} cy={k.y} r={k.bright ? 4.5 : 3.2} fill={k.bright ? '#f6d79a' : '#f2eee4'} />
            <text x={k.x} y={k.y + 30} textAnchor="middle" className="lp-kin-name">{k.name}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ---------- Small per-section constellation motifs ---------- */
function Motif({ kind }: { kind: 'gather' | 'tell' | 'pass' }) {
  return (
    <svg viewBox="0 0 200 200" className="lp-motif" aria-hidden="true">
      <g fill="none" stroke="#e7b45c" strokeWidth="1.2" strokeLinecap="round" opacity="0.85">
        {kind === 'gather' && <path d="M100 40 L60 120 M100 40 L140 120 M60 120 L140 120 M100 40 L100 110" />}
        {kind === 'tell' && <path d="M40 150 C 80 60, 120 60, 160 150" />}
        {kind === 'pass' && <path d="M50 100 L150 100" strokeDasharray="2 10" />}
      </g>
      {kind === 'gather' && [[100, 40, 4.5], [60, 120, 3], [140, 120, 3], [100, 110, 3]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={i === 0 ? '#f6d79a' : '#f2eee4'} />)}
      {kind === 'tell' && [[40, 150, 3], [100, 78, 4.5], [160, 150, 3]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={i === 1 ? '#f6d79a' : '#f2eee4'} />)}
      {kind === 'pass' && <><circle cx="50" cy="100" r="4.5" fill="#f6d79a" /><circle cx="150" cy="100" r="4.5" fill="#f2eee4" /></>}
    </svg>
  );
}

const FEATURES = [
  { kind: 'gather' as const, k: 'Réunir', t: 'Reliez les générations', d: 'Ajoutez vos proches et tracez les liens. L’arbre se dessine de lui-même, lisible des arrière-grands-parents aux petits-derniers.' },
  { kind: 'tell' as const, k: 'Raconter', t: 'L’histoire prend des mots', d: 'À partir des dates, des lieux et des liens, Suimini compose le récit de votre lignée. Une mémoire qui se lit, pas seulement qui se range.' },
  { kind: 'pass' as const, k: 'Transmettre', t: 'Léguez la lumière', d: 'Invitez la famille à contribuer, exportez un livret, partagez un lien. Une histoire faite pour passer de main en main.' },
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

  // Pointer parallax on the hero sky (desktop, motion allowed).
  const skyRef = useRef<HTMLDivElement>(null);
  const onPointer = useCallback((e: React.PointerEvent) => {
    const el = skyRef.current;
    if (!el || prefersReduced()) return;
    const mx = (e.clientX / window.innerWidth - 0.5) * 2;
    const my = (e.clientY / window.innerHeight - 0.5) * 2;
    el.style.setProperty('--mx', String(mx));
    el.style.setProperty('--my', String(my));
  }, []);

  return (
    <div className={`lp-root ${serif.variable}`}>
      {/* ===== NAV ===== */}
      <nav className={`lp-nav ${scrolled ? 'lp-nav-on' : ''}`}>
        <a href="#top" className="lp-word" aria-label="Suimini, accueil">Suimini</a>
        <div className="lp-nav-right">
          <a href="#features" className="lp-nav-link">Comment ça marche</a>
          <LangToggle />
          <button onClick={canEnterApp ? goToApp : () => openAuth('login')} className="lp-nav-cta">
            {canEnterApp ? 'Entrer' : 'Se connecter'}
          </button>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <header id="top" className="lp-hero" onPointerMove={onPointer}>
        <div className="lp-sky" ref={skyRef}><Constellation /></div>
        <div className="lp-hero-veil" aria-hidden="true" />
        <div className="lp-hero-inner">
          <h1 className="lp-h1">
            <span className="lp-h1-a">Votre famille</span>
            <span className="lp-h1-b">est une <em>constellation.</em></span>
          </h1>
          <p className="lp-hero-sub">Chaque nom, une étoile. Chaque lien, une ligne de lumière. Suimini réunit les vôtres et garde leur histoire vivante.</p>
          <div className="lp-hero-cta">
            {canEnterApp ? (
              <button onClick={goToApp} className="lp-btn lp-btn-amber">Ouvrir mon arbre</button>
            ) : (
              <button onClick={startSignup} className="lp-btn lp-btn-amber">Commencer mon arbre</button>
            )}
            <button onClick={startDemo} className="lp-btn lp-btn-ghost">Voir la démo</button>
          </div>
          <p className="lp-hero-fine">C’est gratuit. Aucune carte bancaire. Vos données restent en Europe.</p>
        </div>
        <div className="lp-cue" aria-hidden="true"><span /></div>
      </header>

      {/* ===== MANIFESTO ===== */}
      <section className="lp-manifesto">
        <Reveal>
          <p className="lp-manifesto-q">Tant qu’une histoire se raconte,<br /><em>ceux qu’on aime ne s’éteignent jamais.</em></p>
        </Reveal>
      </section>

      {/* ===== FEATURES (bandes art-dirigées) ===== */}
      <section id="features" className="lp-feats">
        <Reveal>
          <h2 className="lp-h2">Trois gestes pour une mémoire</h2>
        </Reveal>
        <div className="lp-feat-list">
          {FEATURES.map((f, i) => (
            <Reveal key={f.k} as="div" className={`lp-feat ${i % 2 ? 'lp-feat-alt' : ''}`} delay={60}>
              <div className="lp-feat-art"><Motif kind={f.kind} /></div>
              <div className="lp-feat-body">
                <span className="lp-feat-k">{f.k}</span>
                <h3 className="lp-feat-t">{f.t}</h3>
                <p className="lp-feat-d">{f.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== FIGURES (tissées dans une phrase) ===== */}
      <section className="lp-figures">
        <Reveal>
          <p className="lp-fig-line">
            <em>Sept</em> générations. <em>Cinquante-huit</em> vies reliées. <em>Cent cinquante</em> ans de lumière.
          </p>
          <p className="lp-fig-note">L’arbre de la famille Teda, reconstitué dans Suimini.</p>
        </Reveal>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="lp-final">
        <span className="lp-final-star" aria-hidden="true" />
        <Reveal>
          <h2 className="lp-final-h">Commencez votre constellation.</h2>
          <p className="lp-final-sub">Une étoile suffit pour commencer. La vôtre.</p>
          <div className="lp-hero-cta lp-final-cta">
            {canEnterApp ? (
              <button onClick={goToApp} className="lp-btn lp-btn-amber">Ouvrir mon arbre</button>
            ) : (
              <button onClick={startSignup} className="lp-btn lp-btn-amber">Commencer mon arbre</button>
            )}
            <button onClick={startDemo} className="lp-btn lp-btn-ghost">Voir la démo</button>
          </div>
        </Reveal>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="lp-footer">
        <div className="lp-footer-top">
          <div className="lp-footer-brand">
            <div className="lp-word lp-footer-word">Suimini</div>
            <p className="lp-footer-tag">L’histoire de votre famille, gardée vivante.</p>
          </div>
          <nav className="lp-footer-col" aria-label="Produit">
            <span className="lp-footer-h">Produit</span>
            <a href="#features">Comment ça marche</a>
            <button onClick={startDemo} className="lp-footer-btn">Essayer la démo</button>
            <button onClick={canEnterApp ? goToApp : startSignup} className="lp-footer-btn">{canEnterApp ? 'Entrer' : 'Commencer'}</button>
          </nav>
          <nav className="lp-footer-col" aria-label="Légal">
            <span className="lp-footer-h">Légal</span>
            <a href="/cgu">Conditions générales</a>
            <a href="/confidentialite">Confidentialité</a>
          </nav>
          <div className="lp-footer-col">
            <span className="lp-footer-h">Langue</span>
            <LangToggle />
          </div>
        </div>
        <div className="lp-footer-bottom">© 2026 Suimini · Fait avec soin en France</div>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} initialTab={authTab} />}

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.lp-root {
  --sky: #0d0f16; --sky-deep: #090a10; --sky-rise: #12141d;
  --star: #f2eee4; --star-muted: #a8a395; --star-faint: #75716a;
  --amber: #e7b45c; --amber-soft: #f6d79a; --amber-deep: #caa35a;
  --hair: rgba(242,238,228,0.10); --hair-2: rgba(242,238,228,0.16);
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
  background: var(--sky); color: var(--star);
  font-family: var(--lp-serif), Georgia, serif; font-weight: 400;
  overflow-x: hidden; -webkit-font-smoothing: antialiased;
}
.lp-root ::selection { background: rgba(231,180,92,0.30); color: #fff; }

/* Reveal */
.lp-rv { opacity: 0; transform: translateY(22px); transition: opacity 0.8s var(--ease), transform 0.8s var(--ease); }
.lp-rv-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .lp-rv { opacity: 1; transform: none; transition: none; } }

/* Wordmark + lang */
.lp-word { font-family: var(--lp-serif); font-style: italic; font-weight: 500; font-size: 1.6rem; letter-spacing: 0.01em; color: var(--star); text-decoration: none; }
.lp-lang { display: inline-flex; border: 1px solid var(--hair-2); }
.lp-lang button { appearance: none; background: transparent; border: none; border-left: 1px solid var(--hair-2); cursor: pointer; padding: 5px 9px; font-family: var(--lp-serif); font-size: 12px; font-weight: 500; letter-spacing: 0.06em; color: var(--star-muted); transition: color 0.2s, background 0.2s; }
.lp-lang button:first-child { border-left: none; }
.lp-lang button.lp-lang-on { color: var(--sky); background: var(--amber); cursor: default; }
.lp-lang button:not(.lp-lang-on):hover { color: var(--star); }

/* Buttons */
.lp-btn { appearance: none; cursor: pointer; font-family: var(--lp-serif); font-weight: 500; font-size: 1.05rem; padding: 14px 28px; border: 1px solid transparent; border-radius: 0; transition: transform 0.12s var(--ease), box-shadow 0.3s var(--ease), background 0.2s, color 0.2s, border-color 0.2s; line-height: 1.2; }
.lp-btn:active { transform: translateY(1px); }
.lp-btn-amber { background: var(--amber); color: #1a1206; border-color: var(--amber); }
.lp-btn-amber:hover { background: var(--amber-soft); border-color: var(--amber-soft); box-shadow: 0 0 0 1px var(--amber-soft), 0 14px 40px rgba(231,180,92,0.28); }
.lp-btn-ghost { background: transparent; color: var(--star); border-color: var(--hair-2); }
.lp-btn-ghost:hover { border-color: var(--star); background: rgba(242,238,228,0.05); }

/* NAV */
.lp-nav { position: fixed; inset: 0 0 auto 0; z-index: 50; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 22px clamp(20px, 4vw, 56px); transition: background 0.4s var(--ease), border-color 0.4s var(--ease), padding 0.4s var(--ease); border-bottom: 1px solid transparent; }
.lp-nav-on { background: color-mix(in srgb, var(--sky) 80%, transparent); backdrop-filter: blur(12px); border-bottom-color: var(--hair); padding-top: 14px; padding-bottom: 14px; }
.lp-nav-right { display: flex; align-items: center; gap: clamp(16px, 2.5vw, 28px); }
.lp-nav-link { font-family: var(--lp-serif); font-size: 1rem; color: var(--star-muted); text-decoration: none; transition: color 0.2s; }
.lp-nav-link:hover { color: var(--star); }
.lp-nav-cta { appearance: none; background: none; border: none; cursor: pointer; font-family: var(--lp-serif); font-style: italic; font-size: 1.05rem; color: var(--amber); padding: 4px 2px; transition: color 0.2s; }
.lp-nav-cta:hover { color: var(--amber-soft); }
@media (max-width: 720px) { .lp-nav-link { display: none; } }

/* HERO */
.lp-hero { position: relative; min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; justify-content: center; overflow: hidden; background: radial-gradient(140% 90% at 50% 0%, #161425 0%, var(--sky) 46%, var(--sky-deep) 100%); }
.lp-sky { position: absolute; inset: -6% -6% -6% -6%; transform: translate(calc(var(--mx, 0) * 10px), calc(var(--my, 0) * 8px)); transition: transform 0.4s var(--ease); }
.lp-sky-svg { width: 100%; height: 100%; }
.lp-hero-veil { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(54% 44% at 50% 50%, rgba(13,15,22,0.90) 0%, rgba(13,15,22,0.74) 38%, rgba(13,15,22,0.30) 64%, transparent 84%); }
.lp-hero-inner { position: relative; z-index: 3; text-align: center; padding: 96px 24px; max-width: 940px; }
.lp-h1 { margin: 0; font-family: var(--lp-serif); font-weight: 300; letter-spacing: -0.02em; line-height: 1.0; text-wrap: balance; }
.lp-h1-a, .lp-h1-b { display: block; }
.lp-h1-a { font-size: clamp(2.6rem, 7vw, 5rem); color: var(--star); }
.lp-h1-b { font-size: clamp(2.6rem, 7vw, 5rem); color: var(--star); }
.lp-h1-b em { font-style: italic; font-weight: 400; color: var(--amber); }
.lp-hero-sub { margin: 28px auto 0; max-width: 50ch; font-size: clamp(1.05rem, 1.8vw, 1.3rem); line-height: 1.65; color: var(--star-muted); }
.lp-hero-cta { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; margin-top: 40px; }
.lp-hero-fine { margin: 26px 0 0; font-size: 0.92rem; color: var(--star-faint); letter-spacing: 0.01em; }
.lp-cue { position: absolute; left: 50%; bottom: 26px; transform: translateX(-50%); width: 1px; height: 46px; background: linear-gradient(var(--amber), transparent); z-index: 3; overflow: hidden; }
.lp-cue span { position: absolute; inset: 0; background: var(--amber); animation: lp-cue 2.4s var(--ease) infinite; }
@keyframes lp-cue { 0% { transform: translateY(-100%); } 60%, 100% { transform: translateY(100%); } }

/* Sky animations */
.lp-amb { animation: lp-tw 4.5s ease-in-out infinite; }
@keyframes lp-tw { 0%, 100% { opacity: var(--o, 0.6); } 50% { opacity: calc(var(--o, 0.6) * 0.35); } }
.lp-kin { opacity: 0; animation: lp-kin-in 1s var(--ease) forwards; }
@keyframes lp-kin-in { to { opacity: 1; } }
.lp-kin-name { font-family: var(--lp-serif); font-style: italic; font-size: 15px; fill: var(--star-faint); }
.lp-link { stroke-dasharray: 1; stroke-dashoffset: 1; opacity: 0.5; animation: lp-draw 1.4s var(--ease) forwards; }
@keyframes lp-draw { to { stroke-dashoffset: 0; } }
.lp-neb { transform-origin: center; }
.lp-neb-a { animation: lp-drift 26s ease-in-out infinite alternate; }
.lp-neb-b { animation: lp-drift2 32s ease-in-out infinite alternate; }
@keyframes lp-drift { to { transform: translate(36px, 22px) scale(1.06); } }
@keyframes lp-drift2 { to { transform: translate(-30px, -20px) scale(1.08); } }
@media (prefers-reduced-motion: reduce) {
  .lp-amb, .lp-neb-a, .lp-neb-b, .lp-cue span { animation: none; }
  .lp-kin { opacity: 1; animation: none; }
  .lp-link { stroke-dashoffset: 0; animation: none; }
  .lp-sky { transform: none; }
}

/* MANIFESTO */
.lp-manifesto { padding: clamp(96px, 16vw, 200px) 24px; background: linear-gradient(var(--sky-deep), var(--sky)); text-align: center; }
.lp-manifesto-q { margin: 0 auto; max-width: 22ch; font-family: var(--lp-serif); font-weight: 300; font-size: clamp(1.7rem, 4.4vw, 3.1rem); line-height: 1.28; letter-spacing: -0.01em; color: var(--star); text-wrap: balance; }
.lp-manifesto-q em { font-style: italic; color: var(--amber); }

/* FEATURES */
.lp-feats { padding: clamp(72px, 10vw, 132px) clamp(20px, 6vw, 80px); max-width: 1180px; margin: 0 auto; }
.lp-h2 { margin: 0 0 clamp(48px, 7vw, 88px); text-align: center; font-family: var(--lp-serif); font-weight: 400; font-size: clamp(1.9rem, 4vw, 3rem); letter-spacing: -0.015em; color: var(--star); text-wrap: balance; }
.lp-feat-list { display: flex; flex-direction: column; gap: clamp(40px, 6vw, 76px); }
.lp-feat { display: grid; grid-template-columns: 240px 1fr; gap: clamp(28px, 5vw, 72px); align-items: center; }
.lp-feat-alt { grid-template-columns: 1fr 240px; }
.lp-feat-alt .lp-feat-art { order: 2; }
.lp-feat-art { display: flex; align-items: center; justify-content: center; aspect-ratio: 1; border: 1px solid var(--hair); background: radial-gradient(120% 120% at 50% 30%, rgba(231,180,92,0.06), transparent 70%); }
.lp-motif { width: 64%; height: 64%; }
.lp-feat-k { font-family: var(--lp-serif); font-style: italic; font-size: 1.05rem; color: var(--amber); }
.lp-feat-t { margin: 10px 0 0; font-family: var(--lp-serif); font-weight: 400; font-size: clamp(1.5rem, 3vw, 2.2rem); line-height: 1.12; letter-spacing: -0.01em; color: var(--star); }
.lp-feat-d { margin: 16px 0 0; max-width: 52ch; font-size: 1.08rem; line-height: 1.7; color: var(--star-muted); }
@media (max-width: 760px) {
  .lp-feat, .lp-feat-alt { grid-template-columns: 1fr; gap: 22px; }
  .lp-feat-alt .lp-feat-art { order: 0; }
  .lp-feat-art { max-width: 180px; }
}

/* FIGURES */
.lp-figures { padding: clamp(80px, 12vw, 160px) 24px; text-align: center; background: var(--sky-rise); border-top: 1px solid var(--hair); border-bottom: 1px solid var(--hair); }
.lp-fig-line { margin: 0 auto; max-width: 26ch; font-family: var(--lp-serif); font-weight: 300; font-size: clamp(1.8rem, 4.6vw, 3.2rem); line-height: 1.25; letter-spacing: -0.01em; color: var(--star); text-wrap: balance; }
.lp-fig-line em { font-style: normal; font-weight: 500; color: var(--amber); }
.lp-fig-note { margin: 26px 0 0; font-family: var(--lp-serif); font-style: italic; font-size: 1rem; color: var(--star-faint); }

/* FINAL CTA */
.lp-final { position: relative; padding: clamp(110px, 16vw, 220px) 24px; text-align: center; background: radial-gradient(80% 120% at 50% 110%, #1a1730 0%, var(--sky) 60%); overflow: hidden; }
.lp-final-star { position: absolute; top: clamp(40px, 8vw, 96px); left: 50%; width: 10px; height: 10px; border-radius: 50%; background: var(--amber-soft); transform: translateX(-50%); box-shadow: 0 0 0 6px rgba(231,180,92,0.18), 0 0 40px 10px rgba(231,180,92,0.45); animation: lp-pulse 3.4s ease-in-out infinite; }
@keyframes lp-pulse { 0%, 100% { opacity: 0.8; transform: translateX(-50%) scale(1); } 50% { opacity: 1; transform: translateX(-50%) scale(1.25); } }
.lp-final-h { margin: 0; font-family: var(--lp-serif); font-weight: 300; font-size: clamp(2.2rem, 6vw, 4.4rem); line-height: 1.04; letter-spacing: -0.02em; color: var(--star); text-wrap: balance; }
.lp-final-sub { margin: 22px auto 0; max-width: 40ch; font-family: var(--lp-serif); font-style: italic; font-size: clamp(1.1rem, 2.2vw, 1.5rem); color: var(--star-muted); }
.lp-final-cta { margin-top: 40px; }
@media (prefers-reduced-motion: reduce) { .lp-final-star { animation: none; } }

/* FOOTER */
.lp-footer { background: var(--sky-deep); border-top: 1px solid var(--hair); padding: 64px clamp(20px, 6vw, 80px) 32px; }
.lp-footer-top { max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; padding-bottom: 32px; border-bottom: 1px solid var(--hair); }
.lp-footer-word { font-size: 1.7rem; }
.lp-footer-tag { margin: 12px 0 0; max-width: 30ch; font-size: 0.98rem; line-height: 1.6; color: var(--star-faint); }
.lp-footer-col { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
.lp-footer-h { font-family: var(--lp-serif); font-style: italic; font-size: 0.95rem; color: var(--star-faint); }
.lp-footer-col a, .lp-footer-btn { appearance: none; background: none; border: none; padding: 0; cursor: pointer; font-family: var(--lp-serif); font-size: 1rem; color: var(--star-muted); text-decoration: none; text-align: left; transition: color 0.2s; }
.lp-footer-col a:hover, .lp-footer-btn:hover { color: var(--amber); }
.lp-footer-bottom { max-width: 1180px; margin: 22px auto 0; font-family: var(--lp-serif); font-style: italic; font-size: 0.88rem; color: var(--star-faint); }
@media (max-width: 760px) { .lp-footer-top { grid-template-columns: 1fr 1fr; gap: 32px; } .lp-footer-brand { grid-column: 1 / -1; } }
`;
