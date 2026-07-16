'use client';
import { useOverlay } from '@/hooks/useOverlay';
import { useState, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { FamilyTree, Person } from '@/types';
import { getDisplayName, formatDate, formatYear, formatAge, getAge, computeTreeStats, getGeneration } from '@/lib/treeUtils';
import { buildTreeLayout, validateVisualTree, NODE_W, NODE_H } from '@/lib/export/treeLayout';
import { GENDER_BAR } from './tree/nodeStyle';
import { List, LayoutGrid, BarChart3, TreePine, BookOpen, Printer, X, Moon, Sun } from 'lucide-react';
import { ErrorMessage } from './ui/ErrorMessage';

// Built-in event types with a translated label under the `personPanel`
// namespace (`event_*`) — anything else falls back to a capitalised raw
// type string, same convention as PersonPanel's own `eventTypeLabel`.
const KNOWN_EVENT_TYPES = new Set(['birth', 'death', 'marriage', 'divorce', 'baptism', 'graduation', 'military', 'immigration', 'other']);

/* ─────────────────────────────────────────────────────────────────────────
 * PREVIEW THEME (on-screen only) — the printed output is NEVER affected by
 * this. These pure helpers are exported for unit testing. */
export type PreviewMode = 'light' | 'dark';
const PREVIEW_STORAGE_KEY = 'suimini_print_preview_mode';

/** Flip the preview theme (dark ⇄ light). Pure — no side effects. */
export function nextPreviewMode(cur: PreviewMode): PreviewMode {
  return cur === 'dark' ? 'light' : 'dark';
}
/** CSS class controlling the preview well's background (see globals.css). */
export function previewClass(mode: PreviewMode): string {
  return mode === 'light' ? 'print-preview-light' : 'print-preview-dark';
}

const PRINT_MODE_META = {
  livret: { Icon: BookOpen, labelKey: 'mode.livret' },
  list: { Icon: List, labelKey: 'mode.list' },
  cards: { Icon: LayoutGrid, labelKey: 'mode.cards' },
  summary: { Icon: BarChart3, labelKey: 'mode.summary' },
  tree: { Icon: TreePine, labelKey: 'mode.tree' },
} as const;

/* PRINT PALETTE — literal hexes only. The document content is rendered on WHITE
 * for paper, and the same markup is piped into a separate print window that has
 * none of our CSS variables; var(--*) would resolve to nothing there (and to the
 * dark app theme in the on-screen preview). So everything printable is hard-hex. */
const P = {
  paper: '#FFFFFF',
  ink: '#1A1714',     // primary text
  gold: '#96621C',    // accent legible on white — #A36B1E plafonnait à 4.49:1, celui-ci fait 5.17:1
  goldFill: '#C9A84C',// avatar fill
  border: '#E6DECF',  // cream-grey card outlines
  muted: '#4A4742',   // secondary text (≥4.5:1 on white)
  faint: '#6E6A62',   // tertiary / labels
  panel: '#F7F3EC',   // recessed date wells
  male: '#2C5F8A',
  female: '#A8456B',
  neutral: '#6E6A62',
} as const;

function genderColor(g: string) {
  return g === 'male' ? P.male : g === 'female' ? P.female : P.neutral;
}

function initials(p: Person): string {
  const first = (p.firstName || '').trim();
  const second = (p.lastName || '').trim();
  // Convention TEDA : firstName = NOM, lastName = prénom (souvent vide pour les
  // aïeux saisis sous un seul nom, ex. « MEGNIGUE »). Quand un seul champ est
  // renseigné, on prend ses 2 premières lettres → toujours une pastille à 2
  // caractères, jamais une lettre isolée et déséquilibrée.
  const pair = first && second ? first[0] + second[0] : (first || second).slice(0, 2);
  return pair.toUpperCase() || '—';
}

/** Square avatar: real photo when present + enabled, otherwise elegant initials
 *  on gold (Spectral). No emoji, zero radius — prints cleanly. */
function PrintAvatar({ p, photos, size }: { p: Person; photos: boolean; size: number }) {
  if (photos && p.profilePhoto) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.profilePhoto} alt="" style={{ width: size, height: size, flexShrink: 0, objectFit: 'cover', border: `1px solid ${P.border}`, display: 'block' }} />;
  }
  return (
    <div className="serif" aria-hidden="true" style={{
      width: size, height: size, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: P.goldFill, color: P.ink, fontWeight: 700, fontSize: Math.round(size * 0.4), letterSpacing: '0.5px',
    }}>
      {initials(p)}
    </div>
  );
}

/** Small square gender chip — replaces the banned coloured side-stripe borders. */
// Decorative app amber (brighter than P.gold) — for accent bars / pivot dots only,
// never for text (it fails contrast on white). Matches GENDER_BAR.pivot in the app.
const ACCENT_BAR = '#C9A84C';

// How the visual tree fits the page: 'scale' = whole tree on one A3 (default),
// 'paginate' = slice into stacked A3 pages when it is taller than one page.
const VISUAL_TREE_MODE: 'scale' | 'paginate' = 'scale';

/** Initials colour on a gender/pivot fill (cream on the dark "unknown" slate). */
function nodeInk(node: { person: Person; isPivot: boolean }): string {
  if (node.isPivot) return '#1a1714';
  return node.person.gender === 'male' || node.person.gender === 'female' ? '#1a1714' : '#f5f0e8';
}
/** Decorative accent for a tree node (GENDER_BAR is the app's single source). */
function nodeAccent(node: { person: Person; isPivot: boolean }): string {
  if (node.isPivot) return GENDER_BAR.pivot;
  return node.person.gender === 'male' ? GENDER_BAR.male : node.person.gender === 'female' ? GENDER_BAR.female : GENDER_BAR.unknown;
}
function initialsOf(p: Person): string {
  return initials(p);
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function GenderDot({ g, pivot }: { g: string; pivot?: boolean }) {
  return <span aria-hidden="true" style={{ width: '8px', height: '8px', flexShrink: 0, background: pivot ? ACCENT_BAR : genderColor(g), display: 'inline-block' }} />;
}

interface Props {
  tree: FamilyTree;
  onClose: () => void;
}

type PrintMode = 'livret' | 'list' | 'cards' | 'summary' | 'tree';

export default function PrintModal({ tree, onClose }: Props) {
  const t = useTranslations('printModal');
  const tp = useTranslations('personPanel');
  const locale = useLocale();
  const eventTypeLabel = (type: string) =>
    KNOWN_EVENT_TYPES.has(type) ? tp(`event_${type}`) : (type.charAt(0).toUpperCase() + type.slice(1));
  const [mode, setMode] = useState<PrintMode>('livret');
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeDeceased, setIncludeDeceased] = useState(true);
  const [includeEvents, setIncludeEvents] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  // On-screen preview theme. Default = current behaviour (dark) until a saved
  // preference is read on mount. Does NOT alter the printed document.
  const [previewMode, setPreviewMode] = useState<PreviewMode>('dark');
  const printRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') setPreviewMode(saved);
  }, []);

  function applyPreviewMode(next: PreviewMode) {
    setPreviewMode(next);
    if (typeof window !== 'undefined') window.localStorage.setItem(PREVIEW_STORAGE_KEY, next);
  }

  const dateLocale = locale === 'en' ? 'en-US' : 'fr-FR';
  const printedDate = new Date().toLocaleDateString(dateLocale, { day: '2-digit', month: 'long', year: 'numeric' });

  const treeLayout = buildTreeLayout(tree, tree.rootPersonId || tree.persons[0]?.id || null);

  // Dev-only completeness check: renderedNodes must equal totalPersons.
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && mode === 'tree') {
      // eslint-disable-next-line no-console
      console.log('[VisualTree]', { ...validateVisualTree(tree), mode: VISUAL_TREE_MODE });
    }
  }, [mode, tree]);

  async function exportTreePdf() {
    if (!treeRef.current) return;
    setExporting(true);
    setExportError(null);
    try {
      const [{ default: html2canvas }, jspdfMod] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const jsPDF = jspdfMod.jsPDF;

      const canvas = await html2canvas(treeRef.current, {
        backgroundColor: '#ffffff',
        scale: 3,
        useCORS: true,
        logging: false,
      });

      const A3_W = 420, A3_H = 297;             // A3 landscape (mm)
      const margin = 12;
      const topArea = 26;     // title + subtitle + amber rule
      const bottomArea = 16;  // two footer lines
      const availW = A3_W - margin * 2;
      const PX_TO_MM = 25.4 / 96;
      const ratioW = availW / canvas.width;            // mm per px to fill the page width
      const ratioFit = Math.min(ratioW, PX_TO_MM);     // fill width but never upscale past natural size
      const scaleFactor = ratioW / PX_TO_MM;           // rendered vs natural size
      const singleImgH = canvas.height * ratioFit;     // image height on a single page
      const singlePageH = topArea + singleImgH + bottomArea;

      // One page sized to its content (no top/bottom whitespace) unless the tree
      // is too tall to read on one sheet → then paginate across A3 pages.
      const shouldPaginate = VISUAL_TREE_MODE === 'paginate' || scaleFactor < 0.4 || singlePageH > A3_H;

      const pdf = shouldPaginate
        ? new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
        // Custom page height = exactly the content height → page hugs the tree.
        : new jsPDF({ orientation: A3_W >= singlePageH ? 'landscape' : 'portrait', unit: 'mm', format: [A3_W, singlePageH] });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const availH = pageH - topArea - bottomArea;

      // Subtitle: "{n} générations · {n} membres · depuis ~{year}" (year dynamic).
      const years = tree.persons
        .map(p => (p.birthDate ? Number(String(p.birthDate).match(/\d{4}/)?.[0]) : NaN))
        .filter(y => Number.isFinite(y) && y >= 1000) as number[];
      const earliest = years.length ? Math.min(...years) : null;
      let subtitle = t('headerMeta', { generations: stats.totalGenerations, persons: stats.totalPersons });
      if (earliest) subtitle += ' · ' + t('treeSince', { year: earliest });

      // Title + subtitle + amber rule (top) and footer + confidential + page number (bottom).
      const stamp = (pageNo: number, total: number) => {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.setTextColor(163, 107, 30);
        pdf.text(tree.name, pageW / 2, 11, { align: 'center' });
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(110, 106, 98);
        pdf.text(subtitle, pageW / 2, 17, { align: 'center' });
        pdf.setDrawColor(201, 168, 76); pdf.setLineWidth(0.5); pdf.line(pageW / 2 - 28, 20.5, pageW / 2 + 28, 20.5);
        pdf.setFontSize(8); pdf.setTextColor(110, 106, 98);
        pdf.text(t('pdfFooter', { count: tree.persons.length, date: new Date().toLocaleDateString(dateLocale) }), pageW / 2, pageH - 9, { align: 'center' });
        pdf.setFont('helvetica', 'italic'); pdf.setFontSize(7.5);
        pdf.text(t('docFooterConfidential'), pageW / 2, pageH - 5, { align: 'center' });
        if (total > 1) { pdf.setFont('helvetica', 'normal'); pdf.text(t('pageNumber', { n: pageNo, total }), pageW - margin, pageH - 5, { align: 'right' }); }
      };

      if (shouldPaginate) {
        const pagePx = availH / ratioW;                // canvas px that fill one page tall
        const pxPerUnit = canvas.height / treeLayout.height;
        const rowPx = treeLayout.rowTops.map(t0 => (t0 - treeLayout.minY) * pxPerUnit).filter(v => v > 0);
        const bounds = [0, ...rowPx, canvas.height];
        const pages: Array<[number, number]> = [];
        let pStart = 0;
        for (let i = 1; i < bounds.length; i++) {
          if (bounds[i] - pStart > pagePx && bounds[i - 1] > pStart) { pages.push([pStart, bounds[i - 1]]); pStart = bounds[i - 1]; }
        }
        pages.push([pStart, canvas.height]);
        pages.forEach(([y0, y1], i) => {
          if (i > 0) pdf.addPage();
          const h = y1 - y0;
          const slice = document.createElement('canvas');
          slice.width = canvas.width; slice.height = h;
          const sctx = slice.getContext('2d');
          if (sctx) { sctx.fillStyle = '#ffffff'; sctx.fillRect(0, 0, canvas.width, h); sctx.drawImage(canvas, 0, y0, canvas.width, h, 0, 0, canvas.width, h); }
          stamp(i + 1, pages.length);
          pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, topArea, availW, h * ratioW); // top-aligned
        });
      } else {
        // Whole tree on one content-sized page — fill width, top-aligned. The page
        // height was set to topArea + singleImgH + bottomArea, so there is no blank
        // band above or below the tree.
        const imgW = canvas.width * ratioFit;
        stamp(1, 1);
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageW - imgW) / 2, topArea, imgW, singleImgH);
      }

      pdf.save(`${tree.name.replace(/\s+/g, '_')}_${t('fileSuffix')}.pdf`);
    } catch (err) {
      console.error('Export PDF échoué', err);
      setExportError(t('exportFailed'));
    } finally {
      setExporting(false);
    }
  }

  const stats = computeTreeStats(tree);
  const persons = includeDeceased
    ? tree.persons
    : tree.persons.filter(p => p.isAlive);

  const sortedPersons = [...persons].sort((a, b) =>
    a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
  );

  // Persons grouped by generation (depth from roots) for the "Livret" mode.
  const genGroups = (() => {
    const memo = new Map<string, number>();
    const byGen = new Map<number, typeof persons>();
    persons.forEach(p => {
      const g = getGeneration(p.id, tree.relationships, tree.persons, memo);
      const arr = byGen.get(g) ?? [];
      arr.push(p);
      byGen.set(g, arr);
    });
    return [...byGen.entries()].sort((a, b) => a[0] - b[0]).map(([gen, people]) => ({
      gen,
      people: [...people].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)),
    }));
  })();

  function doPrint() {
    if (!printRef.current) return;
    setPrintError(null);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // Popup blocked by the browser — used to fail silently (AUDIT-V5 P1
      // #13), leaving the user pressing "Imprimer" with no feedback at all.
      setPrintError(t('printBlocked'));
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="${locale}">
      <head>
        <meta charset="UTF-8">
        <title>${tree.name} | Suimini</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Spectral:wght@500;600;700&family=Libre+Baskerville:wght@400;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          html, body { background: ${P.paper}; }
          body { font-family: 'Libre Baskerville', Georgia, serif; font-size: 11pt; color: ${P.ink}; padding: 16mm; }
          .serif { font-family: 'Spectral', Georgia, serif; }
          .mono { font-family: 'IBM Plex Mono', monospace; }
          img { max-width: 100%; }
          @page { margin: 14mm; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        ${printRef.current.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  }

  const overlayRef = useOverlay(onClose);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={overlayRef} tabIndex={-1} className="modal" role="dialog" aria-modal="true" aria-labelledby="print-modal-title" style={{ maxWidth: '760px', maxHeight: '90vh' }}>
        {/* Modal chrome — dark, app-themed. Excluded from the printed output. */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="print-modal-title" className="serif" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Printer size={20} aria-hidden="true" /> {t('title')}</h2>
          <button onClick={onClose} aria-label={t('close')} className="btn btn-ghost btn-sm btn-icon"><X size={16} aria-hidden="true" /></button>
        </div>

        {/* Options — trois familles de contrôles VISUELLEMENT distinctes :
            1) sélecteur de FORMAT exclusif  → segmented « soudé » (or = actif)
            2) bascule d'APERÇU (thème écran) → toggle « piste » secondaire (pas d'or)
            3) cases À INCLURE indépendantes → checkboxes carrées natives */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '22px', flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--bg-muted)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <span className="label">{t('sectionFormat')}</span>
            <div className="seg" role="group" aria-label={t('sectionFormat')}>
              {(['livret','list','cards','summary','tree'] as PrintMode[]).map(m => {
                const { Icon, labelKey } = PRINT_MODE_META[m];
                return (
                  <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m}>
                    <Icon size={14} aria-hidden="true" /> {t(labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview theme toggle (on-screen only — never changes the printed doc). */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <span className="label">{t('previewLabel')}</span>
            <div className="seg-toggle" role="group" aria-label={t('previewLabel')}>
              {(['dark','light'] as PreviewMode[]).map(pm => {
                const active = previewMode === pm;
                const Icon = pm === 'light' ? Sun : Moon;
                return (
                  <button key={pm} onClick={() => applyPreviewMode(pm)} aria-pressed={active}>
                    <Icon size={13} aria-hidden="true" /> {t(pm === 'light' ? 'previewLight' : 'previewDark')}
                  </button>
                );
              })}
            </div>
          </div>

          {mode !== 'tree' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span className="label">{t('sectionInclude')}</span>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', minHeight: '34px' }}>
                <label style={{ display: 'flex', gap: '7px', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={includePhotos} onChange={e => setIncludePhotos(e.target.checked)} />
                  {t('optPhotos')}
                </label>
                <label style={{ display: 'flex', gap: '7px', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={includeDeceased} onChange={e => setIncludeDeceased(e.target.checked)} />
                  {t('optDeceased')}
                </label>
                {mode === 'list' && (
                  <label style={{ display: 'flex', gap: '7px', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={includeEvents} onChange={e => setIncludeEvents(e.target.checked)} />
                    {t('optEvents')}
                  </label>
                )}
              </div>
            </div>
          )}
          {mode === 'tree' && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center' }}>{t('treeRoot', { root: treeLayout.rootName || '—' })}</span>
          )}
          {mode === 'tree' ? (
            <button onClick={exportTreePdf} disabled={exporting || treeLayout.nodes.length === 0} aria-busy={exporting} className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}>
              {exporting ? <><span className="spinner" aria-hidden="true" /> {t('generating')}</> : <><Printer size={14} aria-hidden="true" /> {t('exportPdf')}</>}
            </button>
          ) : (
            <button onClick={doPrint} className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}>
              <Printer size={14} /> {t('print')}
            </button>
          )}
        </div>

        {(exportError || printError) && (
          <div style={{ padding: '0 20px 14px' }}>
            <ErrorMessage
              message={exportError || printError || ''}
              onRetry={exportError ? exportTreePdf : doPrint}
            />
          </div>
        )}

        {/* Print preview — paper-coloured well around the white document.
            tabIndex : une région défilante doit être atteignable au clavier (axe
            scrollable-region-focusable). */}
        <div tabIndex={0} role="region" aria-label={t('title')} className={previewClass(previewMode)} style={{ padding: '20px 24px', maxHeight: 'calc(90vh - 160px)', overflowY: 'auto' }}>
          <div ref={printRef} className="print-doc" style={{ background: P.paper, color: P.ink, padding: '28px', boxShadow: '0 2px 16px rgba(0,0,0,0.35)', display: mode === 'tree' ? 'none' : 'block' }}>
            {/* Livret de famille : couverture + une section par génération.
                Styles INLINE + hex littéraux → rendu identique en aperçu ET dans la
                fenêtre d'impression (qui n'a ni nos classes ni nos var()). */}
            {mode === 'livret' && (
              <div>
                <div style={{ minHeight: '560px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', border: `2px solid ${P.ink}`, padding: '40px', pageBreakAfter: 'always' }}>
                  <div className="mono" style={{ textTransform: 'uppercase', letterSpacing: '4px', fontSize: '11px', color: P.gold, marginBottom: '18px' }}>{t('livretCover')}</div>
                  <h1 className="serif" style={{ fontSize: '40px', color: P.ink, margin: '0 0 14px', lineHeight: 1.05, border: 'none' }}>{tree.name}</h1>
                  {tree.description && <div style={{ color: P.muted, fontSize: '13px', maxWidth: '80%', margin: '0 auto 24px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tree.description}</div>}
                  <div style={{ width: '48px', height: '2px', background: ACCENT_BAR, margin: '0 auto 20px' }} />
                  <div className="mono" style={{ fontSize: '11px', color: P.muted, fontWeight: 600, letterSpacing: '1px' }}>{t('coverMeta', { persons: stats.totalPersons, generations: genGroups.length, date: printedDate })}</div>
                </div>
                {genGroups.map(({ gen, people }) => (
                  <div key={gen} style={{ pageBreakBefore: 'always', marginTop: '24px' }}>
                    <h2 className="serif" style={{ fontSize: '20px', color: P.gold, borderBottom: `2px solid ${P.gold}`, paddingBottom: '6px', margin: '0 0 16px' }}>{t('generation', { n: gen + 1 })}</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {people.map(p => (
                        <div key={p.id} style={{ display: 'flex', gap: '10px', padding: '12px', border: `1px solid ${P.border}`, background: P.paper, pageBreakInside: 'avoid', opacity: p.isAlive ? 1 : 0.85 }}>
                          <PrintAvatar p={p} photos={includePhotos} size={56} />
                          <div style={{ minWidth: 0 }}>
                            <div className="serif" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '14px', color: P.ink }}>
                              <GenderDot g={p.gender} /> {getDisplayName(p)}{!p.isAlive ? ' †' : ''}
                            </div>
                            {(p.birthDate || p.birthPlace?.city) && (
                              <div className="mono" style={{ fontSize: '10.5px', color: P.muted, marginTop: '4px' }}>
                                {p.birthDate ? t('bornOn', { gender: p.gender, date: formatDate(p.birthDate, p.birthDateApprox) }) : ''}{p.birthPlace?.city ? t('inPlace', { place: p.birthPlace.city }) : ''}
                              </div>
                            )}
                            {!p.isAlive && p.deathDate && <div className="mono" style={{ fontSize: '10.5px', color: P.muted, marginTop: '2px' }}>{t('diedOn', { gender: p.gender, date: formatDate(p.deathDate, p.deathDateApprox) })}{p.deathPlace?.city ? t('inPlace', { place: p.deathPlace.city }) : ''}</div>}
                            {p.occupation && <div style={{ fontSize: '11px', color: P.faint, marginTop: '3px', fontStyle: 'italic' }}>{p.occupation}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Document header (non-livret modes) */}
            {mode !== 'livret' && (
              <div style={{ textAlign: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: `2px solid ${P.gold}` }}>
                <h1 className="serif" style={{ fontSize: '30px', color: P.gold, margin: '0 0 8px', letterSpacing: '-0.01em', border: 'none' }}>
                  {tree.name}
                </h1>
                {tree.description && (
                  <div style={{ color: P.muted, fontSize: '12px', marginBottom: '8px', maxWidth: '80%', margin: '0 auto 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tree.description}</div>
                )}
                <div className="mono" style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: P.faint }}>
                  {t('headerMeta', { generations: stats.totalGenerations, persons: stats.totalPersons })}
                </div>
                <div className="mono" style={{ fontSize: '10px', letterSpacing: '0.5px', color: P.faint, marginTop: '4px' }}>
                  {t('printedOn', { date: printedDate })}
                </div>
              </div>
            )}

            {mode === 'summary' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '22px' }}>
                  {[
                    { val: stats.totalPersons, lbl: t('statPersons') },
                    { val: stats.totalAlive, lbl: t('statAlive') },
                    { val: stats.totalGenerations, lbl: t('statGenerations') },
                    { val: stats.totalRelationships, lbl: t('statRelationships') },
                  ].map(s => (
                    <div key={s.lbl} style={{ background: P.paper, border: `1px solid ${P.border}`, borderTop: `3px solid ${ACCENT_BAR}`, padding: '16px 10px 14px', textAlign: 'center' }}>
                      <div className="serif" style={{ fontSize: '34px', fontWeight: 700, color: P.gold, lineHeight: 1 }}>{s.val}</div>
                      <div className="mono" style={{ fontSize: '9px', color: P.muted, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, marginTop: '8px' }}>{s.lbl}</div>
                    </div>
                  ))}
                </div>

                <div className="mono" style={{ fontSize: '10px', color: P.gold, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, borderBottom: `1px solid ${P.border}`, paddingBottom: '6px', marginBottom: '12px' }}>
                  {t('membersEyebrow')}
                </div>
                <div>
                  {sortedPersons.map((p, i) => (
                    <div key={p.id} style={{ breakInside: 'avoid', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '6px 8px', background: i % 2 ? '#F8F7F5' : P.paper, opacity: p.isAlive ? 1 : 0.7 }}>
                      <GenderDot g={p.gender} pivot={p.id === (tree.rootPersonId || tree.persons[0]?.id)} />
                      <span><strong style={{ color: P.ink }}>{p.lastName}</strong>, {p.firstName}
                        {p.birthDate && <span className="mono" style={{ color: P.faint }}> · {formatYear(p.birthDate)}</span>}
                        {!p.isAlive && <span style={{ color: P.faint }}> †</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mode === 'list' && (
              <div>
                {sortedPersons.map(p => {
                  const age = getAge(p.birthDate, p.deathDate);
                  return (
                    <div key={p.id} style={{
                      display: 'flex', gap: '12px', alignItems: 'flex-start',
                      padding: '12px 0', borderBottom: `1px solid ${P.border}`,
                      opacity: p.isAlive ? 1 : 0.75, pageBreakInside: 'avoid',
                    }}>
                      <PrintAvatar p={p} photos={includePhotos} size={44} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="serif" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '14px', color: P.ink }}>
                          <GenderDot g={p.gender} />
                          {p.firstName} {p.maidenName ? `(${p.maidenName}) ` : ''}{p.lastName}
                          {!p.isAlive && <span style={{ color: P.faint, fontSize: '12px' }}>†</span>}
                        </div>
                        <div className="mono" style={{ fontSize: '11px', color: P.muted, marginTop: '3px' }}>
                          {p.occupation && <span>{p.occupation} · </span>}
                          {p.birthDate && <span>{t('bornShort', { date: formatDate(p.birthDate) })}</span>}
                          {p.birthPlace?.city && <span>{t('inPlace', { place: p.birthPlace.city })}</span>}
                          {!p.isAlive && p.deathDate && <span> · {t('diedShort', { date: formatDate(p.deathDate) })}</span>}
                          {age !== null && <span> ({formatAge(age)})</span>}
                        </div>
                        {p.bio && <div style={{ fontSize: '11.5px', color: P.faint, marginTop: '4px', fontStyle: 'italic' }}>{p.bio.slice(0, 150)}{p.bio.length > 150 ? '…' : ''}</div>}
                        {includeEvents && p.events && p.events.length > 0 && (
                          <div className="mono" style={{ fontSize: '10px', color: P.faint, marginTop: '4px' }}>
                            {p.events.map(e => `${eventTypeLabel(e.type)}${e.date ? ' ' + formatYear(e.date) : ''}`).join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {mode === 'cards' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {sortedPersons.map(p => {
                  const age = getAge(p.birthDate, p.deathDate);
                  return (
                    <div key={p.id} style={{
                      border: `1px solid ${P.border}`, background: P.paper, padding: '14px',
                      opacity: p.isAlive ? 1 : 0.75, pageBreakInside: 'avoid',
                    }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
                        <PrintAvatar p={p} photos={includePhotos} size={42} />
                        <div style={{ minWidth: 0 }}>
                          <div className="serif" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '14px', color: P.ink }}>
                            <GenderDot g={p.gender} /> {p.firstName} {p.lastName}{!p.isAlive ? ' †' : ''}
                          </div>
                          {p.maidenName && <div style={{ fontSize: '11px', color: P.muted }}>{t('maidenName', { name: p.maidenName })}</div>}
                          {p.occupation && <div style={{ fontSize: '11px', color: P.faint }}>{p.occupation}</div>}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div style={{ background: P.panel, border: `1px solid ${P.border}`, padding: '6px 8px' }}>
                          <div className="mono" style={{ fontSize: '8.5px', color: P.faint, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('cardBirth')}</div>
                          <div className="mono" style={{ fontSize: '11px', color: P.ink, marginTop: '2px' }}>{formatYear(p.birthDate) || '—'}</div>
                          {p.birthPlace?.city && <div style={{ fontSize: '10px', color: P.muted }}>{p.birthPlace.city}</div>}
                        </div>
                        <div style={{ background: P.panel, border: `1px solid ${P.border}`, padding: '6px 8px' }}>
                          <div className="mono" style={{ fontSize: '8.5px', color: P.faint, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            {p.isAlive ? t('cardAge') : t('cardDeath')}
                          </div>
                          <div className="mono" style={{ fontSize: '11px', color: P.ink, marginTop: '2px' }}>
                            {p.isAlive
                              ? (age !== null ? formatAge(age) : '—')
                              : (formatYear(p.deathDate) || '—')}
                          </div>
                          {!p.isAlive && p.deathPlace?.city && <div style={{ fontSize: '10px', color: P.muted }}>{p.deathPlace.city}</div>}
                        </div>
                      </div>
                      {p.bio && <div style={{ marginTop: '10px', fontSize: '10.5px', color: P.faint, fontStyle: 'italic' }}>{p.bio.slice(0, 100)}{p.bio.length > 100 ? '…' : ''}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mono" style={{ textAlign: 'center', marginTop: '24px', color: P.faint, fontSize: '10px', letterSpacing: '0.5px' }}>
              {t('docFooter', { date: printedDate })}
            </div>
            {/* #555 opaque = 7.46:1 sur blanc — l'opacité 0.65 diluait à 3.15:1 (AA exige 4.5). */}
            <div className="mono" style={{ textAlign: 'center', marginTop: '4px', color: '#555', fontSize: '9px', fontStyle: 'italic' }}>
              {t('docFooterConfidential')}
            </div>
          </div>

          {/* Visual tree preview (captured for PDF export) */}
          {mode === 'tree' && (
            <div style={{ overflow: 'auto', maxWidth: '100%' }}>
              {treeLayout.nodes.length === 0 ? (
                <div style={{ background: P.paper, padding: '40px', textAlign: 'center', color: P.muted }}>
                  {t('treeEmpty')}
                </div>
              ) : (
                // Single scalable SVG (viewBox) → fits the preview width and any tree size.
                <div ref={treeRef} style={{ background: P.paper, padding: '8px' }}>
                  <svg
                    viewBox={`${treeLayout.minX} ${treeLayout.minY} ${treeLayout.width} ${treeLayout.height}`}
                    width={treeLayout.width} height={treeLayout.height}
                    style={{ display: 'block', width: '100%', height: 'auto', maxWidth: '100%' }}
                  >
                    {/* connectors */}
                    {/* Main-lineage (amber) drawn LAST so it sits on top of grey stubs. */}
                    {[...treeLayout.edges].sort((a, b) => (a.type === 'parent-main' ? 1 : 0) - (b.type === 'parent-main' ? 1 : 0)).map((e, i) => (
                      <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                        stroke={e.type === 'parent-main' ? ACCENT_BAR : '#888888'}
                        strokeWidth={e.type === 'parent-main' ? 2 : 1.5}
                        strokeLinecap="round"
                        strokeDasharray={e.type === 'spouse' ? '4 3' : 'none'} />
                    ))}
                    {/* unattached band label */}
                    {treeLayout.unattachedCount > 0 && (() => {
                      const u = treeLayout.nodes.filter(n => n.unattached);
                      const uy = Math.min(...u.map(n => n.y));
                      const ux = Math.min(...u.map(n => n.x));
                      return <text x={ux} y={uy - 14} fontFamily="var(--font-mono), monospace" fontSize={11} fontWeight={700} fill={P.gold} letterSpacing={1.5}>{t('unattached').toUpperCase()}</text>;
                    })()}
                    {/* nodes */}
                    {treeLayout.nodes.map(node => {
                      const p = node.person;
                      const age = getAge(p.birthDate, p.deathDate);
                      const by = formatYear(p.birthDate);
                      const dy = formatYear(p.deathDate);
                      const dates = !p.isAlive
                        ? (by && dy ? `${by} – ${dy}` : dy ? `† ${dy}` : by ? `${by} – ?` : '')
                        : (by ? `${by}${age !== null ? ' · ' + formatAge(age) : ''}` : (age !== null ? formatAge(age) : ''));
                      const accent = nodeAccent(node);
                      return (
                        <g key={p.id} transform={`translate(${node.x},${node.y})`} opacity={p.isAlive ? 1 : 0.85}>
                          <rect width={NODE_W} height={NODE_H} fill="#fff" stroke={node.unattached ? GENDER_BAR.unknown : P.border} strokeWidth={node.unattached ? 1.5 : 1} strokeDasharray={node.unattached ? '4,3' : 'none'} />
                          <rect width={5} height={NODE_H} fill={accent} />
                          <rect x={13} y={NODE_H / 2 - 15} width={30} height={30} fill={accent} />
                          <text x={28} y={NODE_H / 2 + 1} textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-display), Georgia, serif" fontSize={12} fontWeight={700} fill={nodeInk(node)}>{initialsOf(p)}</text>
                          {(() => {
                            const fn = truncate(p.firstName || '', 12);
                            const ln = truncate((p.lastName || '') + (!p.isAlive ? ' †' : ''), 13);
                            const nick = (p.nickName || '').trim();
                            // Sans surnom : rendu d'origine (inchangé). Avec surnom : on
                            // ajoute une ligne « surnom » (italique, discret) et on recentre
                            // la pile pour tenir dans la hauteur fixe du nœud (64).
                            if (!nick) {
                              return (
                                <>
                                  <text x={50} y={24} fontFamily="var(--font-display), Georgia, serif" fontSize={12} fontWeight={700} fill={P.ink}>{fn}</text>
                                  <text x={50} y={40} fontFamily="var(--font-display), Georgia, serif" fontSize={11} fill={P.muted}>{ln}</text>
                                  {dates && <text x={50} y={55} fontFamily="var(--font-mono), monospace" fontSize={9} fill={P.faint}>{dates}</text>}
                                </>
                              );
                            }
                            const rows: { text: string; font: number; weight?: number; fill: string; italic?: boolean; mono?: boolean }[] = [
                              { text: fn, font: 12, weight: 700, fill: P.ink },
                              { text: ln, font: 11, fill: P.muted },
                              { text: truncate(nick, 13), font: 9, fill: P.muted, italic: true },
                              ...(dates ? [{ text: dates, font: 9, fill: P.faint, mono: true }] : []),
                            ];
                            const step = 13;
                            const startY = NODE_H / 2 - ((rows.length - 1) * step) / 2 + 4;
                            return (
                              <>
                                {rows.map((r, i) => (
                                  <text key={i} x={50} y={startY + i * step}
                                    fontFamily={r.mono ? 'var(--font-mono), monospace' : 'var(--font-display), Georgia, serif'}
                                    fontSize={r.font} fontWeight={r.weight} fill={r.fill}
                                    fontStyle={r.italic ? 'italic' : undefined}>{r.text}</text>
                                ))}
                              </>
                            );
                          })()}
                          {node.isPivot && <text x={NODE_W - 10} y={17} textAnchor="end" fontSize={12} fill={ACCENT_BAR}>✦</text>}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
