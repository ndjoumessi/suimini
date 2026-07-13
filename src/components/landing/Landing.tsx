'use client';
import { useState, useEffect, useRef } from 'react';
import { Playfair_Display } from 'next/font/google';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import AuthModal from '@/components/AuthModal';
import { BrandMark } from '@/components/Brand';
import { useLocaleSwitch } from '@/components/IntlProvider';
import { LOCALES, type Locale } from '@/i18n/config';

/* =====================================================================
   Suimini — Landing publique.
   Thème « Veillée » (nuit chaude braise + accent or-chandelle), aligné
   sur les VALEURS de la palette de l'app (--bg #16120e, --accent #c9a84c).
   Playfair Display pour le display (cousine didone du DM Serif Display de
   l'app mobile « Canopée »), Figtree (--font-body, chargée globalement)
   pour l'UI/corps. Italique réservé aux rares moments éditoriaux (titre
   hero, manifeste, CTA final). Géométrie douce : CTA en pilule, cartes à
   grands arrondis. Scopée à la landing (aucun token global modifié).
   ===================================================================== */

const serif = Playfair_Display({
  subsets: ['latin'],
  weight: 'variable', // axe complet (400–900)
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
function CountUp({ to, duration = 1700, locale = 'fr' }: { to: number; duration?: number; locale?: string }) {
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
  return <span ref={ref}>{val.toLocaleString(locale === 'en' ? 'en-US' : 'fr-FR')}</span>;
}

/* ---------- Brand logo (mirrors the app sidebar mark: gold square + glyph) ---------- */
function LpLogo({ tagline = false }: { tagline?: boolean }) {
  const t = useTranslations('landing');
  return (
    <a href="/" className="lp-logo" aria-label="Suimini">
      <BrandMark size={30} color="#171006" accent="#171006" surface="#C9A84C" />
      <span className="lp-logo-text">
        <span className="lp-logo-name">Suimini</span>
        {tagline && <span className="lp-logo-tag">{t('brandTagline')}</span>}
      </span>
    </a>
  );
}

/* ---------- Locale toggle (dark) ----------
   Real-time switch via IntlProvider — no reload, the page re-renders in place. */
function LangToggle() {
  const t = useTranslations('landing');
  const { locale, setLocale } = useLocaleSwitch();
  const choose = (next: Locale) => {
    if (next === locale) return;
    setLocale(next);
  };
  return (
    <div className="lp-lang" role="group" aria-label={t('footer.language')}>
      {LOCALES.map((l) => (
        <button key={l} type="button" onClick={() => choose(l)} aria-pressed={l === locale} aria-label={l === 'fr' ? 'Français' : 'English'} className={l === locale ? 'lp-lang-on' : ''}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/* ---------- Constellation data (hero backdrop) ---------- */
// Named family stars (viewBox 0 0 1000 660). bright = root couple.
const KIN = [
  { x: 392, y: 150, bright: true },
  { x: 548, y: 124, bright: true },
  { x: 250, y: 330, bright: false },
  { x: 478, y: 312, bright: false },
  { x: 720, y: 344, bright: false },
  { x: 318, y: 510, bright: false },
  { x: 486, y: 528, bright: false },
  { x: 658, y: 506, bright: false },
];
// Connector paths between generations.
const PATHS = [
  'M392 150 L548 124',
  'M470 137 L470 220 M250 220 L720 220 M250 220 L250 312 M470 220 L470 312 M720 220 L720 344',
  'M478 312 L478 420 M318 420 L658 420 M318 420 L318 510 M486 420 L486 528 M658 420 L658 506',
];

/* Faint, static family constellation — the single decorative touch (no star
   field, no parallax, no per-star twinkle). */
function Constellation() {
  return (
    <svg className="lp-sky-svg" viewBox="0 0 1000 660" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="lp-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.5" />
          <stop offset="60%" stopColor="#c9a84c" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#c9a84c" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="lp-links" fill="none" stroke="#c9a84c" strokeWidth="1" strokeLinecap="round" opacity="0.22">
        {PATHS.map((d, i) => (
          <path key={i} className="lp-link" d={d} pathLength={1} style={{ animationDelay: `${0.3 + i * 0.2}s` }} />
        ))}
      </g>
      <g className="lp-kin-g">
        {KIN.map((k, i) => (
          <g key={i}>
            {k.bright && <circle cx={k.x} cy={k.y} r="26" fill="url(#lp-halo)" />}
            <circle cx={k.x} cy={k.y} r={k.bright ? 4 : 2.6} fill={k.bright ? '#dcc06a' : '#8a7f6c'} />
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ---------- Per-feature line motifs (small, monochrome, static) ---------- */
function Motif({ kind }: { kind: 'gather' | 'tell' | 'pass' }) {
  return (
    <svg viewBox="0 0 200 200" className={`lp-motif lp-motif-${kind}`} aria-hidden="true">
      <g fill="none" stroke="#c9a84c" strokeWidth="1.1" strokeLinecap="round" opacity="0.75">
        {kind === 'gather' && <path className="lp-motif-line" pathLength={1} d="M100 40 L58 112 M100 40 L142 112 M58 112 L40 172 M58 112 L92 172" />}
        {kind === 'tell' && <path className="lp-motif-line" pathLength={1} d="M28 154 C 70 44, 130 44, 172 154" />}
        {kind === 'pass' && <path className="lp-motif-line" pathLength={1} d="M28 100 L172 100" />}
      </g>
      {kind === 'gather' && (
        <>
          <circle cx="100" cy="40" r="5" fill="#dcc06a" />
          {[[58, 112], [142, 112], [40, 172], [92, 172]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.2" fill="#d0c7b4" />)}
        </>
      )}
      {kind === 'tell' && (
        <>
          <circle cx="100" cy="48" r="4.6" fill="#dcc06a" />
          {[[58, 92, 2.4], [142, 92, 2.4], [44, 132, 1.8], [156, 132, 1.8], [78, 60, 1.6], [122, 60, 1.6]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="#d0c7b4" />
          ))}
        </>
      )}
      {kind === 'pass' && (
        <g>
          {[28, 64, 100, 136, 172].map((x, i) => (
            <circle key={i} cx={x} cy={100} r={i === 0 || i === 4 ? 5 : 3.4} fill={i === 0 ? '#dcc06a' : '#d0c7b4'} />
          ))}
        </g>
      )}
    </svg>
  );
}

/* ---------- Section metadata (text comes from messages/landing) ---------- */
const FEATURE_KINDS = ['gather', 'tell', 'pass'] as const;
type FeatureKind = (typeof FEATURE_KINDS)[number];
interface Testimonial { q: string; by: string }
const PLAN_META = [
  { id: 'free', monthly: 0, annual: 0, popular: false, action: 'signup' as const },
  { id: 'family', monthly: 9, annual: 7, popular: true, action: 'signup' as const },
  { id: 'heritage', monthly: 19, annual: 15, popular: false, action: 'contact' as const },
];

export default function Landing() {
  const t = useTranslations('landing');
  const locale = useLocale();
  const testimonials = t.raw('testimonials') as Testimonial[];
  const { startDemo, user, isDemo, isApproved } = useAuth();
  const scrolled = useScrolled();
  const canEnterApp = isDemo || (!!user && isApproved);
  const goToApp = () => { if (typeof window !== 'undefined') window.location.href = '/app'; };
  const [showAuth, setShowAuth] = useState(false);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('signup');
  const openAuth = (tab: 'login' | 'signup') => { setAuthTab(tab); setShowAuth(true); };
  const startSignup = () => openAuth('signup');

  return (
    <div className={`lp-root ${serif.variable}`}>
      {/* ===== NAV ===== */}
      <nav className={`lp-nav ${scrolled ? 'lp-nav-on' : ''}`} aria-label={t('nav.mainAria')}>
        <LpLogo tagline />
        <div className="lp-nav-right">
          <a href="#features" className="lp-nav-link">{t('nav.how')}</a>
          <a href="#tarifs" className="lp-nav-link">{t('nav.pricing')}</a>
          <LangToggle />
          <button onClick={canEnterApp ? goToApp : () => openAuth('login')} className="lp-btn lp-btn-outline lp-btn-sm lp-nav-cta">
            {canEnterApp ? t('nav.enter') : t('nav.signin')}
          </button>
        </div>
      </nav>

      {/* Landmark principal (1.3.1 / 2.4.1) + cible du skip-link global. */}
      <main id="main-content">
      {/* ===== HERO ===== */}
      <header id="top" className="lp-hero">
        <div className="lp-sky"><Constellation /></div>
        <div className="lp-hero-veil" aria-hidden="true" />
        <div className="lp-hero-inner">
          <h1 className="lp-h1">
            <span className="lp-h1-a">{t('hero.title1')}</span>
            <span className="lp-h1-b">{t.rich('hero.title2', { em: (c) => <em>{c}</em> })}</span>
          </h1>
          <p className="lp-hero-sub">{t('hero.sub')}</p>
          <div className="lp-hero-cta">
            {canEnterApp ? (
              <button onClick={goToApp} className="lp-btn lp-btn-amber">{t('hero.ctaOpen')}</button>
            ) : (
              <button onClick={startSignup} className="lp-btn lp-btn-amber">{t('hero.ctaStart')}</button>
            )}
            <button onClick={startDemo} className="lp-btn lp-btn-outline">{t('hero.ctaDemo')}</button>
          </div>
          <p className="lp-hero-count">{t.rich('hero.count', { n: () => <b className="lp-count-n"><CountUp to={2847} locale={locale} /></b> })}</p>
          <p className="lp-hero-fine">{t('hero.fine')}</p>
        </div>
        <div className="lp-cue" aria-hidden="true"><span /></div>
      </header>

      {/* ===== MANIFESTO ===== */}
      <section className="lp-manifesto">
        <Reveal variant="fade">
          <p className="lp-manifesto-q">
            <span className="lp-mani-lead">{t('manifesto.lead')}</span>
            <em>{t('manifesto.em1')}<br />{t('manifesto.em2')}</em>
          </p>
        </Reveal>
        <div className="lp-testi">
          {testimonials.map((tm, i) => (
            <Reveal key={i} as="div" className="lp-testi-item" delay={i * 90} variant="fade">
              <p className="lp-testi-q">“{tm.q}”</p>
              <p className="lp-testi-by"><span className="lp-testi-dash">—</span> {tm.by}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="lp-feats">
        <Reveal>
          <h2 className="lp-h2">{t('features.heading')}</h2>
        </Reveal>
        <div className="lp-feat-list">
          {FEATURE_KINDS.map((kind: FeatureKind, i) => (
            <Reveal key={kind} as="div" className={`lp-feat lp-feat-${i} ${i % 2 ? 'lp-feat-alt' : ''}`} delay={i * 40}>
              <div className="lp-feat-art"><Motif kind={kind} /></div>
              <div className="lp-feat-body">
                <span className="lp-feat-k">{t(`features.${kind}.k`)}</span>
                <h3 className="lp-feat-t">{t(`features.${kind}.t`)}</h3>
                <p className="lp-feat-d">{t(`features.${kind}.d`)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== FIGURES ===== */}
      <section className="lp-figures">
        <Reveal variant="scale">
          <p className="lp-fig-line">
            {t.rich('figures.l1', { em: (c) => <em>{c}</em> })}<br />
            {t.rich('figures.l2', { em: (c) => <em>{c}</em> })}<br />
            {t.rich('figures.l3', { em: (c) => <em>{c}</em> })}
          </p>
          <p className="lp-fig-note">{t('figures.note')}</p>
        </Reveal>
      </section>

      {/* ===== TARIFS ===== */}
      <section id="tarifs" className="lp-pricing">
        <Reveal>
          <h2 className="lp-h2">{t('pricing.heading')}</h2>
          <p className="lp-pricing-sub">{t('pricing.sub')}</p>
          <div className="lp-billing" role="group" aria-label={t('pricing.monthly') + ' / ' + t('pricing.annual')}>
            <button type="button" className={billing === 'monthly' ? 'lp-bill-on' : ''} aria-pressed={billing === 'monthly'} onClick={() => setBilling('monthly')}>{t('pricing.monthly')}</button>
            <button type="button" className={billing === 'annual' ? 'lp-bill-on' : ''} aria-pressed={billing === 'annual'} onClick={() => setBilling('annual')}>
              {t('pricing.annual')} <span className="lp-bill-save">{t('pricing.save')}</span>
            </button>
          </div>
        </Reveal>
        <div className="lp-plans">
          {PLAN_META.map((p, i) => {
            const amount = billing === 'annual' ? p.annual : p.monthly;
            const features = t.raw(`pricing.plans.${p.id}.features`) as string[];
            return (
            <Reveal key={p.id} as="div" className={`lp-plan ${p.popular ? 'lp-plan-pop' : ''}`} delay={i * 80}>
              {p.popular && <span className="lp-plan-badge">{t('pricing.popular')}</span>}
              <span className="lp-plan-name">{t(`pricing.plans.${p.id}.name`)}</span>
              <div className="lp-plan-price">
                {billing === 'annual' && p.monthly > amount && <span className="lp-plan-was">{p.monthly}€</span>}
                <span className="lp-plan-amount" key={`${p.id}-${billing}`}>{amount}€</span>
                {amount > 0 && <span className="lp-plan-period">{t('pricing.perMonth')}</span>}
              </div>
              <span className="lp-plan-note">{billing === 'annual' && amount > 0 ? t('pricing.perYear', { total: amount * 12 }) : t(`pricing.plans.${p.id}.note`)}</span>
              {p.popular && billing === 'annual' && <span className="lp-plan-save">{t('pricing.save')}</span>}
              <ul className="lp-plan-feats">
                {features.map((f) => (
                  <li key={f}><span className="lp-check" aria-hidden="true">✓</span>{f}</li>
                ))}
              </ul>
              {p.action === 'contact' ? (
                <a href="mailto:hello@suimini.app?subject=Suimini%20Héritage" className="lp-btn lp-btn-outline lp-plan-cta">{t(`pricing.plans.${p.id}.cta`)}</a>
              ) : (
                <button onClick={canEnterApp ? goToApp : startSignup} className={`lp-btn ${p.popular ? 'lp-btn-amber' : 'lp-btn-outline'} lp-plan-cta`}>{t(`pricing.plans.${p.id}.cta`)}</button>
              )}
            </Reveal>
            );
          })}
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="lp-final">
        <Reveal className="lp-final-body">
          <h2 className="lp-final-h">{t('cta.title1')} <em>{t('cta.title2')}</em></h2>
          <p className="lp-final-sub">{t('cta.sub')}</p>
          <div className="lp-hero-cta lp-final-cta">
            {canEnterApp ? (
              <button onClick={goToApp} className="lp-btn lp-btn-amber lp-btn-xl">{t('hero.ctaOpen')}</button>
            ) : (
              <button onClick={startSignup} className="lp-btn lp-btn-amber lp-btn-xl">{t('hero.ctaStart')}</button>
            )}
            <button onClick={startDemo} className="lp-btn lp-btn-outline">{t('hero.ctaDemo')}</button>
          </div>
          <p className="lp-final-fine">{t('cta.fine')}</p>
        </Reveal>
      </section>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="lp-footer">
        <div className="lp-footer-top">
          <div className="lp-footer-brand">
            <LpLogo />
            <p className="lp-footer-tag">{t('footer.tagline')}</p>
          </div>
          <nav className="lp-footer-col" aria-label={t('footer.product')}>
            <span className="lp-footer-h">{t('footer.product')}</span>
            <a href="#features">{t('nav.how')}</a>
            <a href="#tarifs">{t('nav.pricing')}</a>
            <button onClick={startDemo} className="lp-footer-btn">{t('footer.tryDemo')}</button>
            <button onClick={canEnterApp ? goToApp : startSignup} className="lp-footer-btn">{canEnterApp ? t('nav.enter') : t('footer.start')}</button>
          </nav>
          <nav className="lp-footer-col lp-footer-legal" aria-label={t('footer.legal')}>
            <span className="lp-footer-h">{t('footer.legal')}</span>
            <a href="/cgu">{t('footer.terms')}</a>
            <a href="/confidentialite">{t('footer.privacy')}</a>
          </nav>
          <div className="lp-footer-col">
            <span className="lp-footer-h">{t('footer.language')}</span>
            <LangToggle />
          </div>
        </div>
        <div className="lp-footer-bottom">{t('footer.copyright')}</div>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} initialTab={authTab} />}

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.lp-root {
  /* Palette « Veillée » (alignée sur l'app) : nuit braise chaude, encre papier, or chandelle.
     Écart de clarté franchement large entre les 4 tons (canvas < deep < rise < card) —
     un premier jet (~2-3 unités RVB d'écart) restait indiscernable à l'œil ; celui-ci
     double quasiment la luminosité perçue du canvas à la carte. */
  --sky: #16120e; --sky-deep: #070504; --sky-rise: #2a231a; --sky-card: #372e22;
  --star: #f3ecdf; --star-muted: #aa9e8c; --star-faint: #9c9081;
  --amber: #c9a84c; --amber-soft: #dcc06a; --amber-deep: #a98c3e;
  --ink-on-amber: #171006;
  --hair: rgba(243,236,223,0.08); --hair-2: rgba(243,236,223,0.16);
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
  background: var(--sky); color: var(--star);
  font-family: var(--font-body), system-ui, sans-serif; font-weight: 400;
  overflow-x: hidden; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
}
.lp-root ::selection { background: rgba(201,168,76,0.30); color: var(--star); }
.lp-root a:focus-visible, .lp-root button:focus-visible { outline: 2px solid var(--amber); outline-offset: 3px; }

/* Reveal */
.lp-rv { opacity: 0; transition: opacity 0.8s var(--ease), transform 0.8s var(--ease); will-change: opacity, transform; }
.lp-rv-up { transform: translateY(24px); }
.lp-rv-fade { transform: none; }
.lp-rv-scale { transform: scale(0.97); }
.lp-rv-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .lp-rv { opacity: 1; transform: none; transition: none; } }

/* Brand logo */
.lp-logo { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: inherit; }
.lp-logo-text { display: flex; flex-direction: column; line-height: 1.1; min-width: 0; }
.lp-logo-name { font-family: var(--lp-serif); font-weight: 600; font-size: 17px; letter-spacing: -0.01em; color: var(--star); }
.lp-logo-tag { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--star-faint); margin-top: 2px; white-space: nowrap; }

/* Language toggle */
.lp-lang { display: inline-flex; border: 1px solid var(--hair-2); border-radius: 999px; overflow: hidden; }
.lp-lang button { appearance: none; background: transparent; border: none; border-left: 1px solid var(--hair-2); cursor: pointer; padding: 5px 9px; font-family: var(--font-body); font-size: 12px; font-weight: 600; letter-spacing: 0.04em; color: var(--star-muted); transition: color 0.2s, background 0.2s; }
.lp-lang button:first-child { border-left: none; }
.lp-lang button.lp-lang-on { color: var(--ink-on-amber); background: var(--amber); cursor: default; }
.lp-lang button:not(.lp-lang-on):hover { color: var(--star); }

/* Buttons — clear, engaging: solid gold (primary) / outline (secondary). */
.lp-btn { appearance: none; cursor: pointer; font-family: var(--font-body); font-weight: 600; font-size: 1rem; letter-spacing: 0.005em; padding: 14px 30px; border: 1px solid transparent; border-radius: 999px; transition: transform 0.12s var(--ease), box-shadow 0.3s var(--ease), background 0.2s, color 0.2s, border-color 0.2s; line-height: 1.2; display: inline-flex; align-items: center; justify-content: center; }
.lp-btn:active { transform: translateY(1px); }
.lp-btn-amber { background: var(--amber); color: var(--ink-on-amber); border-color: var(--amber); }
.lp-btn-amber:hover { background: var(--amber-soft); border-color: var(--amber-soft); transform: translateY(-1px); box-shadow: 0 12px 34px rgba(201,168,76,0.24); }
@media (prefers-reduced-motion: reduce) { .lp-btn-amber:hover { transform: none; } }
.lp-btn-outline { background: transparent; color: var(--star); border-color: var(--hair-2); }
.lp-btn-outline:hover { border-color: var(--amber); color: var(--amber); background: rgba(201,168,76,0.06); }
.lp-btn-sm { padding: 9px 18px; font-size: 0.9rem; }
.lp-btn-xl { font-size: 1.1rem; padding: 18px 44px; }

/* NAV */
.lp-nav { position: fixed; inset: 0 0 auto 0; z-index: 50; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 20px clamp(20px, 4vw, 56px); transition: background 0.4s var(--ease), border-color 0.4s var(--ease), padding 0.4s var(--ease); border-bottom: 1px solid transparent; }
.lp-nav-on { background: color-mix(in srgb, var(--sky) 84%, transparent); backdrop-filter: blur(12px); border-bottom-color: var(--hair); padding-top: 13px; padding-bottom: 13px; }
.lp-nav-right { display: flex; align-items: center; gap: clamp(16px, 2.5vw, 28px); }
.lp-nav-link { font-family: var(--font-body); font-weight: 500; font-size: 0.95rem; color: var(--star-muted); text-decoration: none; transition: color 0.2s; }
.lp-nav-link:hover { color: var(--star); }
@media (max-width: 720px) { .lp-nav-link { display: none; } }

/* HERO */
.lp-hero { position: relative; min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; justify-content: center; overflow: hidden; background: radial-gradient(130% 90% at 50% -10%, #241c12 0%, var(--sky) 48%, var(--sky-deep) 100%); }
.lp-sky { position: absolute; inset: -6%; opacity: 0.9; }
.lp-sky-svg { width: 100%; height: 100%; }
.lp-hero-veil { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(58% 50% at 50% 46%, rgba(23,19,16,0.92) 0%, rgba(23,19,16,0.72) 40%, rgba(23,19,16,0.28) 66%, transparent 86%); }
.lp-hero-inner { position: relative; z-index: 3; text-align: center; padding: 96px 24px; max-width: 1000px; }
.lp-h1 { margin: 0; font-family: var(--lp-serif); font-weight: 500; letter-spacing: -0.01em; line-height: 1.04; text-wrap: balance; }
.lp-h1-a, .lp-h1-b { display: block; font-size: clamp(3rem, 8vw, 5.6rem); color: var(--star); }
.lp-h1-a { font-weight: 400; }
.lp-h1-b em { font-style: italic; font-weight: 500; color: var(--amber); }
.lp-hero-sub { margin: 30px auto 0; max-width: 48ch; font-family: var(--font-body); font-size: clamp(1.05rem, 1.7vw, 1.25rem); font-weight: 400; line-height: 1.65; color: var(--star-muted); }
.lp-hero-cta { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; margin-top: 40px; }
.lp-hero-count { margin: 30px auto 0; max-width: 44ch; font-family: var(--font-body); font-size: 0.98rem; line-height: 1.5; color: var(--star-muted); }
.lp-count-n { font-family: var(--lp-serif); font-weight: 600; color: var(--amber); font-variant-numeric: tabular-nums; }
.lp-hero-fine { margin: 16px 0 0; font-family: var(--font-body); font-size: 0.86rem; color: var(--star-faint); letter-spacing: 0.01em; }
.lp-cue { position: absolute; left: 50%; bottom: 26px; transform: translateX(-50%); width: 1px; height: 44px; background: linear-gradient(var(--amber), transparent); z-index: 3; overflow: hidden; }
.lp-cue span { position: absolute; inset: 0; background: var(--amber); animation: lp-cue 2.4s var(--ease) infinite; }
@keyframes lp-cue { 0% { transform: translateY(-100%); } 60%, 100% { transform: translateY(100%); } }

/* Sky (static constellation, gentle draw-in only) */
.lp-link { stroke-dasharray: 1; stroke-dashoffset: 1; animation: lp-draw 1.4s var(--ease) forwards; }
@keyframes lp-draw { to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) { .lp-link { stroke-dashoffset: 0; animation: none; } .lp-cue span { animation: none; } }

/* MANIFESTO */
.lp-manifesto { padding: clamp(110px, 18vw, 220px) 24px; background: linear-gradient(var(--sky-deep), var(--sky)); text-align: center; }
.lp-manifesto-q { margin: 0 auto; max-width: min(92vw, 860px); }
.lp-mani-lead { display: block; font-family: var(--font-body); font-weight: 400; font-size: clamp(1.1rem, 2.2vw, 1.5rem); line-height: 1.4; color: var(--star-muted); margin-bottom: clamp(16px, 2vw, 28px); }
.lp-manifesto-q em { display: block; font-family: var(--lp-serif); font-style: italic; font-weight: 400; font-size: clamp(2rem, 5.2vw, 3.6rem); line-height: 1.16; letter-spacing: -0.02em; color: var(--amber); text-wrap: balance; }
/* Testimonials */
.lp-testi { max-width: 1080px; margin: clamp(72px, 10vw, 120px) auto 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(28px, 4vw, 52px); text-align: left; }
.lp-testi-q { margin: 0; font-family: var(--lp-serif); font-weight: 400; font-size: 1.15rem; line-height: 1.5; color: rgba(245,240,232,0.92); text-wrap: pretty; }
.lp-testi-by { margin: 14px 0 0; font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.06em; color: var(--star-faint); }
.lp-testi-dash { color: var(--amber); margin-right: 4px; }
@media (max-width: 760px) { .lp-testi { grid-template-columns: 1fr; max-width: 540px; gap: 36px; } }

/* FEATURES */
.lp-feats { padding: clamp(96px, 13vw, 180px) clamp(20px, 6vw, 80px); max-width: 1180px; margin: 0 auto; }
.lp-h2 { margin: 0 0 clamp(60px, 8vw, 112px); text-align: center; font-family: var(--lp-serif); font-weight: 500; font-size: clamp(2rem, 4.4vw, 3.2rem); letter-spacing: -0.01em; color: var(--star); text-wrap: balance; }
.lp-feat-list { display: flex; flex-direction: column; gap: clamp(64px, 9vw, 120px); }
.lp-feat { display: grid; grid-template-columns: 360px 1fr; gap: clamp(32px, 6vw, 88px); align-items: center; }
.lp-feat-alt { grid-template-columns: 1fr 360px; }
.lp-feat-alt .lp-feat-art { order: 2; }
.lp-feat-art { position: relative; display: flex; align-items: center; justify-content: center; aspect-ratio: 1; border: 1px solid var(--hair); background: var(--sky-rise); border-radius: 24px; overflow: hidden; }
.lp-feat-art::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(70% 60% at 50% 40%, rgba(201,168,76,0.08), transparent 72%); }
.lp-motif { position: relative; width: 66%; height: 66%; }
.lp-motif-line { stroke-dasharray: 1; stroke-dashoffset: 1; }
.lp-rv-in .lp-motif-line { animation: lp-draw 1.3s var(--ease) 0.15s forwards; }
.lp-feat-k { font-family: var(--font-body); font-weight: 600; font-size: 0.82rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--amber); }
.lp-feat-t { margin: 12px 0 0; font-family: var(--lp-serif); font-weight: 500; font-size: clamp(1.7rem, 3.2vw, 2.4rem); line-height: 1.12; letter-spacing: -0.02em; color: var(--star); text-wrap: balance; }
.lp-feat-d { margin: 18px 0 0; max-width: 50ch; font-family: var(--font-body); font-size: 1.08rem; line-height: 1.7; color: var(--star-muted); }
@media (prefers-reduced-motion: reduce) { .lp-motif-line { stroke-dashoffset: 0; animation: none; } }
@media (max-width: 760px) {
  .lp-feat, .lp-feat-alt { grid-template-columns: 1fr; gap: 26px; }
  .lp-feat-alt .lp-feat-art { order: 0; }
  .lp-feat-art { max-width: 200px; justify-self: center; }
}

/* FIGURES */
.lp-figures { padding: clamp(104px, 15vw, 200px) 24px; text-align: center; background: var(--sky-rise); border-top: 1px solid var(--hair); border-bottom: 1px solid var(--hair); }
.lp-fig-line { margin: 0 auto; max-width: 16ch; font-family: var(--lp-serif); font-weight: 400; font-size: clamp(2.3rem, 6.6vw, 4.6rem); line-height: 1.16; letter-spacing: -0.02em; color: var(--star); }
.lp-fig-line em { font-style: normal; font-weight: 600; color: var(--amber); }
.lp-fig-note { margin: clamp(30px, 4vw, 44px) 0 0; font-family: var(--font-body); font-size: 1.02rem; color: var(--star-faint); }

/* FINAL CTA */
.lp-final { position: relative; padding: clamp(112px, 15vw, 190px) 24px clamp(96px, 12vw, 160px); text-align: center; background: radial-gradient(80% 120% at 50% 120%, #292012 0%, #1c1610 44%, var(--sky) 74%); overflow: hidden; }
.lp-final::before { content: ''; position: absolute; left: 50%; top: 0; width: 1px; height: clamp(80px, 12vw, 160px); transform: translateX(-50%); background: linear-gradient(transparent, rgba(201,168,76,0.4)); pointer-events: none; }
.lp-final-body { position: relative; z-index: 1; }
.lp-final-fine { margin: 26px 0 0; font-family: var(--font-body); font-size: 0.86rem; color: var(--star-faint); letter-spacing: 0.01em; }
.lp-final-h { margin: 0; font-family: var(--lp-serif); font-weight: 500; font-size: clamp(2.5rem, 6.6vw, 4.4rem); line-height: 1.08; letter-spacing: -0.01em; color: var(--star); text-wrap: balance; }
.lp-final-h em { font-style: italic; font-weight: 500; color: var(--amber); }
.lp-final-sub { margin: 22px auto 0; max-width: 48ch; font-family: var(--font-body); font-size: clamp(1rem, 1.6vw, 1.2rem); line-height: 1.6; color: var(--star-muted); }
.lp-final-cta { margin-top: 44px; }

/* PRICING */
.lp-pricing { background: var(--sky-deep); border-top: 1px solid var(--hair); padding: clamp(104px, 14vw, 190px) clamp(20px, 6vw, 80px); }
.lp-pricing .lp-h2 { margin-bottom: 0; }
.lp-pricing-sub { margin: 18px auto 0; text-align: center; font-family: var(--font-body); font-size: clamp(1.05rem, 1.8vw, 1.3rem); color: var(--star-muted); }
/* Billing toggle */
.lp-billing { display: flex; width: fit-content; margin: clamp(30px, 3.4vw, 42px) auto 0; border: 1px solid var(--hair-2); border-radius: 999px; overflow: hidden; }
.lp-billing button { appearance: none; background: transparent; border: none; cursor: pointer; font-family: var(--font-body); font-weight: 500; font-size: 0.98rem; color: var(--star-muted); padding: 10px 22px; display: inline-flex; align-items: center; gap: 10px; transition: color 0.2s, background 0.2s; }
.lp-billing button + button { border-left: 1px solid var(--hair-2); }
.lp-billing button:not(.lp-bill-on):hover { color: var(--star); }
.lp-billing .lp-bill-on { background: var(--amber); color: var(--ink-on-amber); cursor: default; }
.lp-bill-save { font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.04em; padding: 2px 8px; border-radius: 999px; background: rgba(201,168,76,0.18); color: var(--amber); }
.lp-billing .lp-bill-on .lp-bill-save { background: rgba(23,16,6,0.18); color: var(--ink-on-amber); }
.lp-plan-amount { animation: lp-amount-in 0.5s var(--ease); }
@keyframes lp-amount-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .lp-plan-amount { animation: none; } }
.lp-plans { max-width: 1100px; margin: clamp(60px, 7vw, 92px) auto 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(20px, 2.2vw, 26px); align-items: stretch; }
.lp-plan { position: relative; display: flex; flex-direction: column; background: var(--sky-card); border: 1px solid var(--hair); border-radius: 20px; padding: clamp(32px, 3.2vw, 44px) clamp(26px, 2.6vw, 36px); transition: transform 0.3s var(--ease), border-color 0.3s var(--ease), box-shadow 0.3s var(--ease); }
.lp-plan:not(.lp-plan-pop):hover { transform: translateY(-4px); border-color: var(--hair-2); }
.lp-plan-pop { background: #282017; border-color: var(--amber); transform: translateY(-12px); box-shadow: 0 24px 60px rgba(10,6,3,0.45), 0 0 0 1px var(--amber); }
.lp-plan-badge { position: absolute; top: 0; right: clamp(26px, 2.6vw, 36px); transform: translateY(-50%); background: var(--amber); color: var(--ink-on-amber); font-family: var(--font-body); font-weight: 600; font-size: 0.78rem; letter-spacing: 0.04em; padding: 4px 14px; border-radius: 999px; }
.lp-plan-name { font-family: var(--font-body); font-weight: 600; font-size: 0.85rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--star-muted); }
.lp-plan-pop .lp-plan-name { color: var(--amber); }
.lp-plan-price { margin: 22px 0 0; display: flex; align-items: baseline; gap: 8px; }
.lp-plan-amount { font-family: var(--lp-serif); font-weight: 500; font-size: clamp(3.2rem, 5.2vw, 4.4rem); line-height: 0.95; letter-spacing: -0.01em; color: var(--star); font-variant-numeric: tabular-nums; }
.lp-plan-pop .lp-plan-amount { color: var(--amber-soft); }
.lp-plan-was { align-self: flex-end; margin-bottom: 8px; font-family: var(--lp-serif); font-size: 1.3rem; color: var(--star-faint); text-decoration: line-through; text-decoration-color: var(--amber); }
.lp-plan-period { font-family: var(--font-body); font-size: 1.05rem; color: var(--star-faint); }
.lp-plan-note { margin-top: 10px; font-family: var(--font-body); font-size: 0.98rem; color: var(--star-muted); }
.lp-plan-save { align-self: flex-start; margin-top: 10px; font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 10px; border-radius: 999px; background: rgba(201,168,76,0.16); color: var(--amber); }
.lp-plan-feats { list-style: none; margin: clamp(28px, 3vw, 38px) 0 0; padding: clamp(28px, 3vw, 36px) 0 0; border-top: 1px solid var(--hair); display: flex; flex-direction: column; gap: 14px; flex: 1; }
.lp-plan-feats li { display: flex; gap: 12px; align-items: flex-start; font-family: var(--font-body); font-size: 1.02rem; line-height: 1.5; color: var(--star-muted); }
.lp-check { color: var(--amber); font-size: 0.9rem; line-height: 1.6; flex-shrink: 0; }
.lp-plan-cta { width: 100%; justify-content: center; margin-top: clamp(30px, 3.4vw, 42px); }
@media (max-width: 860px) {
  .lp-plans { grid-template-columns: 1fr; max-width: 440px; gap: 22px; }
  .lp-plan-pop { transform: none; }
  .lp-plan:not(.lp-plan-pop):hover { transform: none; }
}

/* FOOTER */
.lp-footer { background: var(--sky-deep); border-top: 1px solid var(--hair); padding: 64px clamp(20px, 6vw, 80px) 32px; }
.lp-footer-top { max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; padding-bottom: 32px; border-bottom: 1px solid var(--hair); }
.lp-footer-tag { margin: 12px 0 0; font-family: var(--font-body); font-size: 0.95rem; line-height: 1.6; color: var(--star-faint); white-space: nowrap; }
.lp-footer-col { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
.lp-footer-h { font-family: var(--font-body); font-weight: 600; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--star-faint); }
.lp-footer-col a, .lp-footer-btn { appearance: none; background: none; border: none; padding: 0; cursor: pointer; font-family: var(--font-body); font-size: 0.98rem; color: var(--star-muted); text-decoration: none; text-align: left; transition: color 0.2s; }
.lp-footer-col a:hover, .lp-footer-btn:hover { color: var(--amber); }
.lp-footer-legal a { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.04em; color: var(--star-muted); }
.lp-footer-legal a:hover { color: var(--amber); }
.lp-footer-bottom { max-width: 1180px; margin: 22px auto 0; font-family: var(--font-body); font-size: 0.86rem; color: var(--star-faint); }
@media (max-width: 760px) { .lp-footer-top { grid-template-columns: 1fr 1fr; gap: 32px; } .lp-footer-brand { grid-column: 1 / -1; } }
`;
