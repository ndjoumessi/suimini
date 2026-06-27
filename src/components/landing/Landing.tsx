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
  weight: ['200', '300', '400', '500', '600', '700'],
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

/* ---------- Reveal: visible-by-default + replay on view (skill-safe) ----------
   variant varies the entrance per section (the uniform fade-up-everywhere is the
   saturated default the impeccable skill warns against). */
function Reveal({ children, delay = 0, as = 'div', variant = 'up', className = '', style }: { children: React.ReactNode; delay?: number; as?: 'div' | 'section' | 'li'; variant?: 'up' | 'fade' | 'scale'; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (prefersReduced()) { setSeen(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.16, rootMargin: '0px 0px -10% 0px' });
    io.observe(el);
    const t = window.setTimeout(() => setSeen(true), 1600); // fallback: never stay hidden
    return () => { io.disconnect(); clearTimeout(t); };
  }, []);
  const Tag = as as React.ElementType;
  return (
    <Tag ref={ref} className={`lp-rv lp-rv-${variant} ${seen ? 'lp-rv-in' : ''} ${className}`} style={{ ...style, transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

/* ---------- Count-up (animates once, on view) ---------- */
function CountUp({ to, duration = 1700 }: { to: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (prefersReduced()) { setVal(to); return; }
    const el = ref.current;
    if (!el) return;
    let raf = 0, start = 0, done = false;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      setVal(Math.round(to * ease(p)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !done) { done = true; raf = requestAnimationFrame(step); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, duration]);
  return <span ref={ref}>{val.toLocaleString('fr-FR')}</span>;
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
// Ambient field stars (percent coords), curated for a calm, dense scatter.
const FIELD = [
  [6, 18, 1.4, 0.7], [14, 64, 1, 0.5], [9, 86, 1.6, 0.6], [21, 32, 1, 0.45], [27, 78, 1.3, 0.7],
  [34, 12, 1, 0.5], [38, 52, 1.5, 0.6], [44, 88, 1, 0.4], [52, 22, 1.2, 0.6], [58, 70, 1, 0.5],
  [63, 40, 1.5, 0.7], [69, 14, 1, 0.45], [73, 84, 1.3, 0.6], [79, 56, 1, 0.5], [84, 28, 1.5, 0.7],
  [88, 74, 1.1, 0.55], [92, 44, 1, 0.5], [96, 16, 1.4, 0.65], [3, 46, 1, 0.4], [48, 8, 1, 0.5],
  [17, 6, 1.2, 0.6], [31, 94, 1, 0.45], [66, 92, 1.2, 0.55], [82, 6, 1, 0.5], [97, 90, 1.3, 0.6],
  [11, 38, 0.9, 0.4], [55, 48, 0.9, 0.45], [76, 36, 0.9, 0.4], [42, 70, 0.9, 0.5], [24, 56, 0.9, 0.45],
  [2, 70, 1.1, 0.5], [8, 54, 0.8, 0.4], [19, 84, 1, 0.55], [29, 20, 0.9, 0.45], [36, 66, 1.1, 0.5],
  [41, 36, 0.8, 0.4], [47, 60, 1, 0.5], [50, 92, 0.9, 0.45], [54, 14, 1.1, 0.55], [61, 58, 0.8, 0.4],
  [67, 28, 1, 0.5], [71, 70, 0.9, 0.45], [78, 18, 1.1, 0.55], [83, 48, 0.8, 0.4], [86, 62, 1, 0.5],
  [90, 34, 0.9, 0.45], [94, 60, 1.1, 0.5], [99, 38, 0.8, 0.4], [13, 24, 0.8, 0.4], [22, 48, 1, 0.5],
  [33, 40, 0.8, 0.4], [45, 26, 0.9, 0.45], [59, 34, 0.8, 0.4], [64, 80, 1, 0.5], [74, 50, 0.8, 0.4],
  [80, 88, 0.9, 0.45], [87, 14, 0.8, 0.4], [93, 78, 1, 0.5], [5, 32, 0.8, 0.4], [70, 6, 0.9, 0.45],
  // +15 — denser field
  [10, 12, 1.2, 0.6], [16, 92, 0.9, 0.45], [26, 6, 1, 0.5], [37, 84, 1.1, 0.55], [49, 40, 0.9, 0.45],
  [53, 80, 1.2, 0.6], [62, 12, 1, 0.5], [68, 50, 0.9, 0.45], [75, 92, 1.1, 0.55], [81, 38, 1, 0.5],
  [88, 90, 0.9, 0.45], [91, 8, 1.2, 0.6], [95, 52, 1, 0.5], [40, 18, 0.9, 0.45], [58, 90, 1.1, 0.55],
  // +15 — denser still, more dynamism
  [7, 24, 1, 0.5], [15, 50, 0.8, 0.4], [23, 14, 1.1, 0.55], [30, 60, 0.9, 0.45], [44, 50, 0.8, 0.4],
  [51, 32, 1, 0.5], [57, 6, 0.9, 0.45], [65, 64, 1.1, 0.55], [72, 24, 0.8, 0.4], [77, 64, 1, 0.5],
  [84, 42, 0.9, 0.45], [89, 24, 1.1, 0.55], [96, 70, 1, 0.5], [12, 78, 0.9, 0.45], [38, 96, 1, 0.5],
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
            <circle cx={k.x} cy={k.y} r={k.bright ? 30 : 20} fill="url(#lp-halo)" className={k.bright ? 'lp-kin-glow' : undefined} />
            <circle cx={k.x} cy={k.y} r={k.bright ? 4.5 : 3.2} fill={k.bright ? '#f6d79a' : '#f2eee4'} />
            <text x={k.x} y={k.y + 30} textAnchor="middle" className="lp-kin-name" style={{ fontSize: k.bright ? 20 : [16, 13, 17, 14, 15, 13][i % 6] }}>{k.name}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ---------- Per-feature constellation motifs (distinct, lightly animated) ---------- */
function Motif({ kind }: { kind: 'gather' | 'tell' | 'pass' }) {
  return (
    <svg viewBox="0 0 200 200" className={`lp-motif lp-motif-${kind}`} aria-hidden="true">
      <g fill="none" stroke="#e7b45c" strokeWidth="1.1" strokeLinecap="round" opacity="0.7">
        {/* Réunir: arbre à 5 nœuds */}
        {kind === 'gather' && <path className="lp-motif-line" pathLength={1} d="M100 40 L58 112 M100 40 L142 112 M58 112 L40 172 M58 112 L92 172" />}
        {/* Raconter: arc de cercle */}
        {kind === 'tell' && <path className="lp-motif-line" pathLength={1} d="M28 154 C 70 44, 130 44, 172 154" />}
        {/* Transmettre: chaîne de 5 nœuds */}
        {kind === 'pass' && <path className="lp-motif-line" pathLength={1} d="M28 100 L172 100" />}
      </g>

      {kind === 'gather' && (
        <>
          <circle className="lp-m-core" cx="100" cy="40" r="5" fill="#f6d79a" />
          {[[58, 112], [142, 112], [40, 172], [92, 172]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.2" fill="#f2eee4" />)}
        </>
      )}

      {kind === 'tell' && (
        <>
          <circle className="lp-m-core" cx="100" cy="48" r="4.6" fill="#f6d79a" />
          <g className="lp-twinkle">
            {[[58, 92, 2.4], [142, 92, 2.4], [44, 132, 1.8], [156, 132, 1.8], [78, 60, 1.6], [122, 60, 1.6]].map(([x, y, r], i) => (
              <circle key={i} cx={x} cy={y} r={r} fill="#f2eee4" style={{ animationDelay: `${i * 0.34}s` }} />
            ))}
          </g>
        </>
      )}

      {kind === 'pass' && (
        <g className="lp-relay">
          {[28, 64, 100, 136, 172].map((x, i) => (
            <circle key={i} cx={x} cy={100} r={i === 0 || i === 4 ? 5 : 3.4} fill={i === 0 ? '#f6d79a' : '#f2eee4'} style={{ animationDelay: `${i * 0.28}s` }} />
          ))}
        </g>
      )}
    </svg>
  );
}

/* ---------- Testimonials ---------- */
const TESTIMONIALS = [
  { q: 'Nous avons retrouvé 4 générations perdues en une soirée.', who: 'Sophie M.', where: 'Lyon' },
  { q: 'Mon père ne connaissait pas le nom de son arrière-grand-père. Maintenant si.', who: 'Karim B.', where: 'Marseille' },
  { q: 'L’IA a écrit la biographie de ma grand-mère mieux que je n’aurais pu le faire.', who: 'Claire D.', where: 'Paris' },
];

const FEATURES = [
  { kind: 'gather' as const, k: 'Réunir', t: 'Reliez les générations', d: 'Ajoutez vos proches et tracez les liens. L’arbre se dessine de lui-même, lisible des arrière-grands-parents aux petits-derniers.' },
  { kind: 'tell' as const, k: 'Raconter', t: 'L’histoire prend des mots', d: 'À partir des dates, des lieux et des liens, Suimini compose le récit de votre lignée. Une mémoire qui se lit, pas seulement qui se range.' },
  { kind: 'pass' as const, k: 'Transmettre', t: 'Léguez la lumière', d: 'Invitez la famille à contribuer, exportez un livret, partagez un lien. Une histoire faite pour passer de main en main.' },
];

const PLANS = [
  {
    name: 'Gratuit', monthly: 0, annual: 0, note: 'Pour toujours', popular: false, action: 'signup' as const, cta: 'Commencer gratuitement',
    features: ['1 arbre généalogique', 'Jusqu’à 50 membres', 'Narratif IA (5/mois)', 'Export PDF basique'],
  },
  {
    name: 'Famille', monthly: 9, annual: 7, note: 'Par famille', popular: true, action: 'signup' as const, cta: 'Choisir ce plan',
    features: ['Arbres illimités', 'Membres illimités', 'Narratif IA illimité', 'Collaboration famille', 'Export PDF premium', 'Galerie photos'],
  },
  {
    name: 'Héritage', monthly: 19, annual: 15, note: 'Pour les grandes familles', popular: false, action: 'contact' as const, cta: 'Nous contacter',
    features: ['Tout du plan Famille', 'Reconnaissance faciale IA', 'Import GEDCOM', 'Accès API', 'Support prioritaire', 'Archivage longue durée'],
  },
];

export default function Landing() {
  const { startDemo, user, isDemo, isApproved } = useAuth();
  const scrolled = useScrolled();
  const canEnterApp = isDemo || (!!user && isApproved);
  const goToApp = () => { if (typeof window !== 'undefined') window.location.href = '/app'; };
  const [showAuth, setShowAuth] = useState(false);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
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
          <a href="#tarifs" className="lp-nav-link">Tarifs</a>
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
          <p className="lp-hero-count">Rejoignez <b className="lp-count-n"><CountUp to={2847} /></b> familles qui préservent leur histoire.</p>
          <p className="lp-hero-fine">C’est gratuit. Aucune carte bancaire. Vos données restent en Europe.</p>
        </div>
        <div className="lp-cue" aria-hidden="true"><span /></div>
      </header>

      {/* ===== MANIFESTO ===== */}
      <section className="lp-manifesto">
        <Reveal variant="fade">
          <p className="lp-manifesto-q">
            <span className="lp-mani-lead">Tant qu’une histoire se raconte,</span>
            <em>ceux qu’on aime<br />ne s’éteignent jamais.</em>
          </p>
        </Reveal>
        <div className="lp-testi">
          {TESTIMONIALS.map((tm, i) => (
            <Reveal key={tm.who} as="div" className="lp-testi-item" delay={i * 90} variant="fade">
              <p className="lp-testi-q">“{tm.q}”</p>
              <p className="lp-testi-by"><span className="lp-testi-dash">—</span> {tm.who}, {tm.where}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== FEATURES (bandes art-dirigées) ===== */}
      <section id="features" className="lp-feats">
        <Reveal>
          <h2 className="lp-h2">Trois gestes pour une mémoire</h2>
        </Reveal>
        <div className="lp-feat-list">
          {FEATURES.map((f, i) => (
            <Reveal key={f.k} as="div" className={`lp-feat lp-feat-${i} ${i % 2 ? 'lp-feat-alt' : ''}`} delay={i * 40}>
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
        <Reveal variant="scale">
          <p className="lp-fig-line">
            <em>Sept</em> générations.<br /><em>Cinquante-huit</em> vies reliées.<br /><em>Cent cinquante</em> ans de lumière.
          </p>
          <p className="lp-fig-note">Des vies réelles. Des liens vrais. Une mémoire vivante.</p>
        </Reveal>
      </section>

      {/* ===== TARIFS ===== */}
      <section id="tarifs" className="lp-pricing">
        <Reveal>
          <h2 className="lp-h2">Simple et transparent</h2>
          <p className="lp-pricing-sub">Commencez gratuitement. Évoluez quand vous êtes prêt.</p>
          <div className="lp-billing" role="group" aria-label="Période de facturation">
            <button type="button" className={billing === 'monthly' ? 'lp-bill-on' : ''} aria-pressed={billing === 'monthly'} onClick={() => setBilling('monthly')}>Mensuel</button>
            <button type="button" className={billing === 'annual' ? 'lp-bill-on' : ''} aria-pressed={billing === 'annual'} onClick={() => setBilling('annual')}>
              Annuel <span className="lp-bill-save">Économisez 20%</span>
            </button>
          </div>
        </Reveal>
        <div className="lp-plans">
          {PLANS.map((p, i) => {
            const amount = billing === 'annual' ? p.annual : p.monthly;
            return (
            <Reveal key={p.name} as="div" className={`lp-plan ${p.popular ? 'lp-plan-pop' : ''}`} delay={i * 80}>
              {p.popular && <span className="lp-plan-badge">Populaire</span>}
              <span className="lp-plan-name">{p.name}</span>
              <div className="lp-plan-price">
                {billing === 'annual' && p.monthly > amount && <span className="lp-plan-was" aria-label={`${p.monthly}€ par mois`}>{p.monthly}€</span>}
                <span className="lp-plan-amount" key={`${p.name}-${billing}`}>{amount}€</span>
                {amount > 0 && <span className="lp-plan-period">/mois</span>}
              </div>
              <span className="lp-plan-note">{billing === 'annual' && amount > 0 ? `Soit ${amount * 12}€ par an` : p.note}</span>
              {p.popular && billing === 'annual' && <span className="lp-plan-save">Économisez 20%</span>}
              <ul className="lp-plan-feats">
                {p.features.map((f) => (
                  <li key={f}><span className="lp-check" aria-hidden="true">✓</span>{f}</li>
                ))}
              </ul>
              {p.action === 'contact' ? (
                <a href="mailto:hello@suimini.app?subject=Suimini%20Héritage" className="lp-btn lp-btn-ghost lp-plan-cta">{p.cta}</a>
              ) : (
                <button onClick={canEnterApp ? goToApp : startSignup} className={`lp-btn ${p.popular ? 'lp-btn-amber' : 'lp-btn-ghost'} lp-plan-cta`}>{p.cta}</button>
              )}
            </Reveal>
            );
          })}
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="lp-final">
        <span className="lp-final-star" aria-hidden="true" />
        <svg className="lp-final-constel" viewBox="0 0 600 340" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <g fill="none" stroke="#e7b45c" strokeWidth="1" strokeLinecap="round" opacity="0.34">
            <path d="M300 70 L300 150 M168 150 L432 150 M168 150 L168 240 M300 150 L300 240 M432 150 L432 240" />
          </g>
          <g fill="#f6d79a">
            <circle cx="300" cy="70" r="3.6" />
            <circle cx="168" cy="150" r="2" /><circle cx="432" cy="150" r="2" />
            <circle cx="168" cy="240" r="2.6" /><circle cx="300" cy="240" r="2.6" /><circle cx="432" cy="240" r="2.6" />
          </g>
        </svg>
        <Reveal className="lp-final-body">
          <h2 className="lp-final-h">Commencez votre<br /><em>constellation.</em></h2>
          <p className="lp-final-sub">Ajoutez une première étoile ce soir. Le reste de votre histoire suivra, génération après génération.</p>
          <div className="lp-hero-cta lp-final-cta">
            {canEnterApp ? (
              <button onClick={goToApp} className="lp-btn lp-btn-amber lp-btn-xl">Ouvrir mon arbre</button>
            ) : (
              <button onClick={startSignup} className="lp-btn lp-btn-amber lp-btn-xl">Commencer mon arbre</button>
            )}
            <button onClick={startDemo} className="lp-btn lp-btn-ghost">Voir la démo</button>
          </div>
          <p className="lp-final-fine">Gratuit. Sans carte bancaire. Données en Europe.</p>
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
            <a href="#tarifs">Tarifs</a>
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

/* Reveal — variant entrances (not the uniform fade-up-everywhere default) */
.lp-rv { opacity: 0; transition: opacity 0.9s var(--ease), transform 0.9s var(--ease); will-change: opacity, transform; }
.lp-rv-up { transform: translateY(28px); }
.lp-rv-fade { transform: none; }
.lp-rv-scale { transform: scale(0.965); }
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
.lp-btn-amber:hover { background: var(--amber-soft); border-color: var(--amber-soft); transform: translateY(-1px); box-shadow: 0 0 0 1px var(--amber-soft), 0 14px 40px rgba(231,180,92,0.28); }
@media (prefers-reduced-motion: reduce) { .lp-btn-amber:hover { transform: none; } }
.lp-btn-ghost { background: transparent; color: var(--star); border-color: var(--hair-2); }
.lp-btn-ghost:hover { border-color: var(--star); background: rgba(242,238,228,0.05); }
.lp-btn-xl { font-size: 1.2rem; padding: 20px 48px; }
.lp-btn-amber.lp-btn-xl:hover { box-shadow: 0 0 0 1px var(--amber-soft), 0 18px 52px rgba(231,180,92,0.34); }

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
.lp-sky { position: absolute; inset: -8% -8% -8% -8%; transform: translate(calc(var(--mx, 0) * 16px), calc(var(--my, 0) * 12px)); transition: transform 0.5s var(--ease); }
.lp-sky-svg { width: 100%; height: 100%; }
.lp-hero-veil { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(54% 44% at 50% 50%, rgba(13,15,22,0.90) 0%, rgba(13,15,22,0.74) 38%, rgba(13,15,22,0.30) 64%, transparent 84%); }
.lp-hero-inner { position: relative; z-index: 3; text-align: center; padding: 96px 24px; max-width: 1040px; }
.lp-h1 { margin: 0; font-family: var(--lp-serif); font-weight: 200; letter-spacing: -0.035em; line-height: 0.92; text-wrap: balance; }
.lp-h1-a, .lp-h1-b { display: block; }
.lp-h1-a { font-size: clamp(3rem, 8.4vw, 6rem); color: var(--star); }
.lp-h1-b { font-size: clamp(3rem, 8.4vw, 6rem); color: var(--star); }
.lp-h1-b em { font-style: italic; font-weight: 500; color: var(--amber); }
.lp-hero-sub { margin: 34px auto 0; max-width: 46ch; font-size: clamp(1.1rem, 1.9vw, 1.35rem); line-height: 1.7; color: var(--star-muted); }
.lp-hero-cta { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; margin-top: 44px; }
.lp-hero-count { margin: 32px auto 0; max-width: 44ch; font-size: 1.02rem; line-height: 1.5; color: var(--star-muted); }
.lp-count-n { font-style: italic; font-weight: 600; color: var(--amber); font-variant-numeric: tabular-nums; }
.lp-hero-fine { margin: 18px 0 0; font-size: 0.9rem; color: var(--star-faint); letter-spacing: 0.02em; }
.lp-cue { position: absolute; left: 50%; bottom: 26px; transform: translateX(-50%); width: 1px; height: 46px; background: linear-gradient(var(--amber), transparent); z-index: 3; overflow: hidden; }
.lp-cue span { position: absolute; inset: 0; background: var(--amber); animation: lp-cue 2.4s var(--ease) infinite; }
@keyframes lp-cue { 0% { transform: translateY(-100%); } 60%, 100% { transform: translateY(100%); } }

/* Sky animations */
.lp-far { animation: lp-field-drift 84s ease-in-out infinite alternate; }
@keyframes lp-field-drift { to { transform: translate(12px, -9px); } }
.lp-amb { animation: lp-tw 4.5s ease-in-out infinite; }
@keyframes lp-tw { 0%, 100% { opacity: var(--o, 0.6); } 50% { opacity: calc(var(--o, 0.6) * 0.35); } }
.lp-kin { opacity: 0; animation: lp-kin-in 1s var(--ease) forwards; }
@keyframes lp-kin-in { to { opacity: 1; } }
.lp-kin-glow { animation: lp-glow 5s ease-in-out infinite; }
@keyframes lp-glow { 0%, 100% { opacity: 0.65; } 50% { opacity: 1; } }
.lp-kin-name { font-family: var(--lp-serif); font-style: italic; font-size: 15px; fill: var(--star-faint); }
.lp-link { stroke-dasharray: 1; stroke-dashoffset: 1; opacity: 0.5; animation: lp-draw 1.4s var(--ease) forwards; }
@keyframes lp-draw { to { stroke-dashoffset: 0; } }
.lp-neb { transform-origin: center; }
.lp-neb-a { animation: lp-drift 26s ease-in-out infinite alternate; }
.lp-neb-b { animation: lp-drift2 32s ease-in-out infinite alternate; }
@keyframes lp-drift { to { transform: translate(36px, 22px) scale(1.06); } }
@keyframes lp-drift2 { to { transform: translate(-30px, -20px) scale(1.08); } }
@media (prefers-reduced-motion: reduce) {
  .lp-amb, .lp-neb-a, .lp-neb-b, .lp-cue span, .lp-far, .lp-kin-glow { animation: none; }
  .lp-kin { opacity: 1; animation: none; }
  .lp-link { stroke-dashoffset: 0; animation: none; }
  .lp-sky { transform: none; }
}

/* MANIFESTO */
.lp-manifesto { padding: clamp(120px, 20vw, 260px) 24px; background: linear-gradient(var(--sky-deep), var(--sky)); text-align: center; }
.lp-manifesto-q { margin: 0 auto; max-width: min(92vw, 880px); }
.lp-mani-lead { display: block; font-family: var(--lp-serif); font-weight: 300; font-size: clamp(1.15rem, 2.4vw, 1.7rem); line-height: 1.3; letter-spacing: 0.01em; color: var(--star-muted); margin-bottom: clamp(14px, 2vw, 26px); }
.lp-manifesto-q em { display: block; font-family: var(--lp-serif); font-style: italic; font-weight: 400; font-size: clamp(2rem, 5.4vw, 3.8rem); line-height: 1.16; letter-spacing: -0.02em; color: var(--amber); text-wrap: balance; }
/* Testimonials (Spectral italic, single-family — no mono, keeps the direction) */
.lp-testi { max-width: 1080px; margin: clamp(72px, 10vw, 130px) auto 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(28px, 4vw, 54px); text-align: left; }
.lp-testi-q { margin: 0; font-family: var(--lp-serif); font-style: italic; font-weight: 300; font-size: 1.1rem; line-height: 1.55; color: rgba(242,238,228,0.9); text-wrap: pretty; }
.lp-testi-by { margin: 14px 0 0; font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.06em; color: var(--star-faint); }
.lp-testi-dash { color: var(--amber); margin-right: 4px; }
@media (max-width: 760px) { .lp-testi { grid-template-columns: 1fr; max-width: 540px; gap: 38px; } }

/* FEATURES */
.lp-feats { padding: clamp(96px, 13vw, 180px) clamp(20px, 6vw, 80px); max-width: 1180px; margin: 0 auto; }
.lp-h2 { margin: 0 0 clamp(64px, 9vw, 120px); text-align: center; font-family: var(--lp-serif); font-weight: 300; font-size: clamp(2rem, 4.6vw, 3.4rem); letter-spacing: -0.02em; color: var(--star); text-wrap: balance; }
.lp-feat-list { display: flex; flex-direction: column; gap: clamp(64px, 9vw, 128px); }
.lp-feat { display: grid; grid-template-columns: 400px 1fr; gap: clamp(32px, 6vw, 96px); align-items: center; }
.lp-feat-alt { grid-template-columns: 1fr 400px; }
.lp-feat-alt .lp-feat-art { order: 2; }
.lp-feat-art { position: relative; display: flex; align-items: center; justify-content: center; aspect-ratio: 1; }
.lp-feat-art::before { content: ''; position: absolute; inset: 0; pointer-events: none; }
/* distinct art direction per feature: framed top-glow / frameless center-glow / framed bottom-glow */
.lp-feat-0 .lp-feat-art { border: 1px solid var(--hair); }
.lp-feat-0 .lp-feat-art::before { background: radial-gradient(80% 70% at 50% 22%, rgba(231,180,92,0.10), transparent 70%); }
.lp-feat-1 .lp-feat-art::before { background: radial-gradient(62% 62% at 50% 50%, rgba(231,180,92,0.14), transparent 72%); }
.lp-feat-2 .lp-feat-art { border: 1px solid var(--hair); }
.lp-feat-2 .lp-feat-art::before { background: radial-gradient(80% 70% at 50% 80%, rgba(231,180,92,0.10), transparent 70%); }
.lp-motif { position: relative; width: 70%; height: 70%; }
.lp-feat-1 .lp-motif { width: 84%; height: 84%; }
.lp-m-core { transform-box: fill-box; transform-origin: center; animation: lp-glow 4s ease-in-out infinite; }
.lp-seq circle { animation: lp-seqpulse 2.8s ease-in-out infinite; }
@keyframes lp-seqpulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
/* Raconter: étoiles qui clignotent · Transmettre: relais gauche→droite */
.lp-twinkle circle { animation: lp-twk 2.6s ease-in-out infinite; }
@keyframes lp-twk { 0%, 100% { opacity: 0.22; } 50% { opacity: 1; } }
.lp-relay circle { animation: lp-relay 2.4s ease-in-out infinite; }
@keyframes lp-relay { 0%, 100% { opacity: 0.4; } 35% { opacity: 1; } }
/* Motif lines draw on scroll (gated on the section's reveal) */
.lp-motif-line { stroke-dasharray: 1; stroke-dashoffset: 1; }
.lp-rv-in .lp-motif-line { animation: lp-draw 1.3s var(--ease) 0.15s forwards; }
.lp-feat-k { font-family: var(--lp-serif); font-style: italic; font-size: 1.15rem; color: var(--amber); }
.lp-feat-t { margin: 14px 0 0; font-family: var(--lp-serif); font-weight: 400; font-size: clamp(1.7rem, 3.4vw, 2.6rem); line-height: 1.1; letter-spacing: -0.02em; color: var(--star); text-wrap: balance; }
.lp-feat-d { margin: 20px 0 0; max-width: 50ch; font-size: 1.12rem; line-height: 1.75; color: var(--star-muted); }
@media (prefers-reduced-motion: reduce) { .lp-m-core, .lp-seq circle, .lp-twinkle circle, .lp-relay circle { animation: none; opacity: 1; } .lp-motif-line { stroke-dashoffset: 0; animation: none; } }
@media (max-width: 760px) {
  .lp-feat, .lp-feat-alt { grid-template-columns: 1fr; gap: 28px; }
  .lp-feat-alt .lp-feat-art { order: 0; }
  .lp-feat-art { max-width: 220px; }
}

/* FIGURES */
.lp-figures { padding: clamp(110px, 16vw, 220px) 24px; text-align: center; background: var(--sky-rise); border-top: 1px solid var(--hair); border-bottom: 1px solid var(--hair); }
.lp-fig-line { margin: 0 auto; max-width: 16ch; font-family: var(--lp-serif); font-weight: 200; font-size: clamp(2.4rem, 7vw, 5rem); line-height: 1.14; letter-spacing: -0.03em; color: var(--star); }
.lp-fig-line em { font-style: normal; font-weight: 300; color: var(--amber); }
.lp-fig-note { margin: clamp(32px, 4vw, 48px) 0 0; font-family: var(--lp-serif); font-style: italic; font-size: 1.05rem; color: var(--star-faint); }

/* FINAL CTA */
.lp-final { position: relative; padding: clamp(112px, 15vw, 200px) 24px clamp(96px, 12vw, 168px); text-align: center; background: radial-gradient(90% 130% at 50% 116%, #221d3a 0%, #14111f 42%, var(--sky) 72%); overflow: hidden; }
/* a thin meridian of light rising into the star */
.lp-final::before { content: ''; position: absolute; left: 50%; top: 0; width: 1px; height: clamp(90px, 14vw, 200px); transform: translateX(-50%); background: linear-gradient(transparent, rgba(231,180,92,0.5)); pointer-events: none; }
.lp-final-star { position: absolute; z-index: 2; top: clamp(54px, 11vw, 150px); left: 50%; width: 12px; height: 12px; border-radius: 50%; background: var(--amber-soft); transform: translateX(-50%); box-shadow: 0 0 0 7px rgba(231,180,92,0.16), 0 0 0 16px rgba(231,180,92,0.07), 0 0 60px 16px rgba(231,180,92,0.5); animation: lp-pulse 3.6s ease-in-out infinite; }
.lp-final-constel { position: absolute; left: 50%; top: 50%; width: min(560px, 84vw); transform: translate(-50%, -44%); opacity: 0.5; pointer-events: none; z-index: 0; }
.lp-final-constel g:last-of-type { animation: lp-glow 5s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .lp-final-constel g:last-of-type { animation: none; } }
.lp-final-body { position: relative; z-index: 1; }
.lp-final-fine { margin: 28px 0 0; font-size: 0.9rem; color: var(--star-faint); letter-spacing: 0.02em; }
@keyframes lp-pulse { 0%, 100% { opacity: 0.85; transform: translateX(-50%) scale(1); } 50% { opacity: 1; transform: translateX(-50%) scale(1.3); } }
.lp-final-h { margin: 0; font-family: var(--lp-serif); font-style: italic; font-weight: 300; font-size: clamp(2.6rem, 7vw, 4.6rem); line-height: 1.04; letter-spacing: -0.03em; color: var(--amber); text-wrap: balance; }
.lp-final-h em { font-style: italic; font-weight: 400; color: var(--amber-soft); }
.lp-final-sub { margin: 22px auto 0; max-width: 46ch; font-family: var(--lp-serif); font-style: italic; font-size: clamp(1.02rem, 1.7vw, 1.25rem); line-height: 1.55; color: var(--star-muted); }
.lp-final-cta { margin-top: 48px; }
@media (prefers-reduced-motion: reduce) { .lp-final-star { animation: none; } }

/* PRICING */
.lp-pricing { background: #0f0f1a; border-top: 1px solid var(--hair); padding: clamp(110px, 15vw, 200px) clamp(20px, 6vw, 80px); }
.lp-pricing .lp-h2 { margin-bottom: 0; }
.lp-pricing-sub { margin: 20px auto 0; text-align: center; font-family: var(--lp-serif); font-style: italic; font-size: clamp(1.15rem, 2.2vw, 1.5rem); color: var(--star-muted); }
/* Billing toggle */
.lp-billing { display: flex; width: fit-content; margin: clamp(30px, 3.4vw, 44px) auto 0; border: 1px solid var(--hair-2); }
.lp-billing button { appearance: none; background: transparent; border: none; cursor: pointer; font-family: var(--lp-serif); font-size: 1.02rem; color: var(--star-muted); padding: 10px 22px; display: inline-flex; align-items: center; gap: 10px; transition: color 0.2s, background 0.2s; }
.lp-billing button + button { border-left: 1px solid var(--hair-2); }
.lp-billing button:not(.lp-bill-on):hover { color: var(--star); }
.lp-billing .lp-bill-on { background: var(--amber); color: #1a1206; cursor: default; }
.lp-bill-save { font-style: italic; font-size: 0.78rem; padding: 2px 9px; background: rgba(231,180,92,0.18); color: var(--amber); }
.lp-billing .lp-bill-on .lp-bill-save { background: rgba(26,18,6,0.22); color: #1a1206; }
.lp-plan-amount { animation: lp-amount-in 0.55s var(--ease); }
@keyframes lp-amount-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .lp-plan-amount { animation: none; } }
.lp-plans { max-width: 1100px; margin: clamp(64px, 7vw, 96px) auto 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(20px, 2.2vw, 28px); align-items: stretch; }
.lp-plan { position: relative; display: flex; flex-direction: column; background: #16161f; border: 1px solid var(--hair); padding: clamp(32px, 3.2vw, 44px) clamp(26px, 2.6vw, 36px); transition: transform 0.3s var(--ease), border-color 0.3s var(--ease), box-shadow 0.3s var(--ease); }
.lp-plan:not(.lp-plan-pop):hover { transform: translateY(-4px); border-color: var(--hair-2); }
.lp-plan-pop { background: #1d1d27; border-color: var(--amber); transform: translateY(-14px); box-shadow: 0 30px 70px rgba(231,180,92,0.16), 0 0 0 1px var(--amber); }
.lp-plan-badge { position: absolute; top: 0; right: clamp(26px, 2.6vw, 36px); transform: translateY(-50%); background: var(--amber); color: #1a1206; font-family: var(--lp-serif); font-style: italic; font-size: 0.85rem; padding: 4px 15px; letter-spacing: 0.01em; }
.lp-plan-name { font-family: var(--lp-serif); font-weight: 500; font-size: 1.05rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--star-muted); }
.lp-plan-pop .lp-plan-name { color: var(--amber); }
.lp-plan-price { margin: 22px 0 0; display: flex; align-items: baseline; gap: 8px; }
.lp-plan-amount { font-family: var(--lp-serif); font-weight: 200; font-size: clamp(3.4rem, 5.5vw, 4.6rem); line-height: 0.9; letter-spacing: -0.03em; color: var(--star); font-variant-numeric: tabular-nums; }
.lp-plan-pop .lp-plan-amount { color: var(--amber-soft); }
.lp-plan-was { align-self: flex-end; margin-bottom: 8px; font-family: var(--lp-serif); font-size: 1.3rem; color: var(--star-faint); text-decoration: line-through; text-decoration-color: var(--amber); }
.lp-plan-period { font-family: var(--lp-serif); font-size: 1.1rem; color: var(--star-faint); }
.lp-plan-note { margin-top: 10px; font-family: var(--lp-serif); font-style: italic; font-size: 1.02rem; color: var(--star-muted); }
.lp-plan-save { align-self: flex-start; margin-top: 10px; font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 9px; background: rgba(231,180,92,0.16); color: var(--amber); }
.lp-plan-feats { list-style: none; margin: clamp(28px, 3vw, 38px) 0 0; padding: clamp(28px, 3vw, 36px) 0 0; border-top: 1px solid var(--hair); display: flex; flex-direction: column; gap: 15px; flex: 1; }
.lp-plan-feats li { display: flex; gap: 12px; align-items: flex-start; font-size: 1.05rem; line-height: 1.5; color: var(--star-muted); }
.lp-check { color: var(--amber); font-size: 0.92rem; line-height: 1.6; flex-shrink: 0; }
.lp-plan-cta { width: 100%; justify-content: center; margin-top: clamp(30px, 3.4vw, 42px); }
@media (max-width: 860px) {
  .lp-plans { grid-template-columns: 1fr; max-width: 440px; gap: 22px; }
  .lp-plan-pop { transform: none; }
  .lp-plan:not(.lp-plan-pop):hover { transform: none; }
}

/* FOOTER */
.lp-footer { background: var(--sky-deep); border-top: 1px solid var(--hair); padding: 64px clamp(20px, 6vw, 80px) 32px; }
.lp-footer-top { max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; padding-bottom: 32px; border-bottom: 1px solid var(--hair); }
.lp-footer-word { font-size: 1.7rem; }
.lp-footer-tag { margin: 12px 0 0; font-size: 0.98rem; line-height: 1.6; color: var(--star-faint); white-space: nowrap; }
.lp-footer-col { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
.lp-footer-h { font-family: var(--lp-serif); font-style: italic; font-size: 0.95rem; color: var(--star-faint); }
.lp-footer-col a, .lp-footer-btn { appearance: none; background: none; border: none; padding: 0; cursor: pointer; font-family: var(--lp-serif); font-size: 1rem; color: var(--star-muted); text-decoration: none; text-align: left; transition: color 0.2s; }
.lp-footer-col a:hover, .lp-footer-btn:hover { color: var(--amber); }
/* legal links — mono tiny muted */
.lp-footer [aria-label="Légal"] a { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.04em; color: var(--star-muted); }
.lp-footer [aria-label="Légal"] a:hover { color: var(--amber); }
.lp-footer-bottom { max-width: 1180px; margin: 22px auto 0; font-family: var(--lp-serif); font-style: italic; font-size: 0.88rem; color: var(--star-faint); }
@media (max-width: 760px) { .lp-footer-top { grid-template-columns: 1fr 1fr; gap: 32px; } .lp-footer-brand { grid-column: 1 / -1; } }
`;
