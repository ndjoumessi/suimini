'use client';
import { useOverlay } from '@/hooks/useOverlay';
import { useState, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { FamilyTree, Person } from '@/types';
import { getDisplayName, formatDate, formatYear, formatAge, getAge, computeTreeStats, getGeneration } from '@/lib/treeUtils';
import { buildTreeLayout, NODE_W, NODE_H } from '@/lib/treeLayout';
import { List, LayoutGrid, BarChart3, TreePine, BookOpen, Printer, X } from 'lucide-react';

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
  gold: '#A36B1E',    // accent that stays legible on white (≥4.5:1)
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
  const a = (p.firstName || '').trim()[0] || '';
  const b = (p.lastName || '').trim()[0] || '';
  return (a + b).toUpperCase() || '—';
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
function GenderDot({ g }: { g: string }) {
  return <span aria-hidden="true" style={{ width: '8px', height: '8px', flexShrink: 0, background: genderColor(g), display: 'inline-block' }} />;
}

interface Props {
  tree: FamilyTree;
  onClose: () => void;
}

type PrintMode = 'livret' | 'list' | 'cards' | 'summary' | 'tree';

export default function PrintModal({ tree, onClose }: Props) {
  const t = useTranslations('printModal');
  const locale = useLocale();
  const [mode, setMode] = useState<PrintMode>('livret');
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeDeceased, setIncludeDeceased] = useState(true);
  const [includeEvents, setIncludeEvents] = useState(true);
  const [exporting, setExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  const dateLocale = locale === 'en' ? 'en-US' : 'fr-FR';
  const printedDate = new Date().toLocaleDateString(dateLocale, { day: '2-digit', month: 'long', year: 'numeric' });

  const treeLayout = buildTreeLayout(tree, tree.rootPersonId || tree.persons[0]?.id || null);

  async function exportTreePdf() {
    if (!treeRef.current) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, jspdfMod] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const jsPDF = jspdfMod.jsPDF;

      const canvas = await html2canvas(treeRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
      const pageW = pdf.internal.pageSize.getWidth();   // 420mm
      const pageH = pdf.internal.pageSize.getHeight();  // 297mm
      const margin = 12;
      const topArea = 20;    // title band
      const bottomArea = 12; // footer band
      const availW = pageW - margin * 2;
      const availH = pageH - topArea - bottomArea;

      const ratio = Math.min(availW / canvas.width, availH / canvas.height);
      const imgW = canvas.width * ratio;
      const imgH = canvas.height * ratio;
      const imgX = (pageW - imgW) / 2;
      const imgY = topArea + (availH - imgH) / 2;

      // Title
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.setTextColor(163, 107, 30); // P.gold
      pdf.text(tree.name, pageW / 2, 14, { align: 'center' });

      // Tree image
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', imgX, imgY, imgW, imgH);

      // Footer
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(110, 106, 98); // P.faint
      pdf.text(
        t('pdfFooter', { count: tree.persons.length, date: new Date().toLocaleDateString(dateLocale) }),
        pageW / 2, pageH - 5, { align: 'center' }
      );

      pdf.save(`${tree.name.replace(/\s+/g, '_')}_${t('fileSuffix')}.pdf`);
    } catch (err) {
      console.error('Export PDF échoué', err);
      alert(t('exportFailed'));
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
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

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
      <div ref={overlayRef} tabIndex={-1} className="modal" style={{ maxWidth: '760px', maxHeight: '90vh' }}>
        {/* Modal chrome — dark, app-themed. Excluded from the printed output. */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="serif" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Printer size={20} aria-hidden="true" /> {t('title')}</h2>
          <button onClick={onClose} aria-label={t('close')} className="btn btn-ghost btn-sm btn-icon"><X size={16} /></button>
        </div>

        {/* Options */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-muted)' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['livret','list','cards','summary','tree'] as PrintMode[]).map(m => {
              const { Icon, labelKey } = PRINT_MODE_META[m];
              return (
              <button key={m} onClick={() => setMode(m)} className="btn btn-sm" style={{
                background: mode === m ? 'var(--accent)' : 'var(--bg-card)',
                color: mode === m ? '#0d0d0d' : 'var(--text-muted)',
                borderColor: mode === m ? 'var(--accent)' : 'var(--border-strong)',
              }}>
                <Icon size={14} aria-hidden="true" /> {t(labelKey)}
              </button>
            ); })}
          </div>
          {mode !== 'tree' && (
            <>
              <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={includePhotos} onChange={e => setIncludePhotos(e.target.checked)} />
                {t('optPhotos')}
              </label>
              <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={includeDeceased} onChange={e => setIncludeDeceased(e.target.checked)} />
                {t('optDeceased')}
              </label>
            </>
          )}
          {mode === 'list' && (
            <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}>
              <input type="checkbox" checked={includeEvents} onChange={e => setIncludeEvents(e.target.checked)} />
              {t('optEvents')}
            </label>
          )}
          {mode === 'tree' && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('treeRoot', { root: tree.persons.find(p => p.id === (tree.rootPersonId || tree.persons[0]?.id))?.firstName || '—' })}</span>
          )}
          {mode === 'tree' ? (
            <button onClick={exportTreePdf} disabled={exporting || treeLayout.nodes.length === 0} className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}>
              {exporting ? <><span className="spinner" /> {t('generating')}</> : <><Printer size={14} /> {t('exportPdf')}</>}
            </button>
          ) : (
            <button onClick={doPrint} className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}>
              <Printer size={14} /> {t('print')}
            </button>
          )}
        </div>

        {/* Print preview — paper-coloured well around the white document. */}
        <div style={{ padding: '20px 24px', maxHeight: 'calc(90vh - 160px)', overflowY: 'auto', background: '#3a3a44' }}>
          <div ref={printRef} className="print-doc" style={{ background: P.paper, color: P.ink, padding: '28px', boxShadow: '0 2px 16px rgba(0,0,0,0.35)', display: mode === 'tree' ? 'none' : 'block' }}>
            {/* Livret de famille : couverture + une section par génération.
                Styles INLINE + hex littéraux → rendu identique en aperçu ET dans la
                fenêtre d'impression (qui n'a ni nos classes ni nos var()). */}
            {mode === 'livret' && (
              <div>
                <div style={{ minHeight: '560px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', border: `2px solid ${P.ink}`, padding: '40px', pageBreakAfter: 'always' }}>
                  <div className="mono" style={{ textTransform: 'uppercase', letterSpacing: '4px', fontSize: '11px', color: P.gold, marginBottom: '18px' }}>{t('livretCover')}</div>
                  <h1 className="serif" style={{ fontSize: '40px', color: P.ink, margin: '0 0 14px', lineHeight: 1.05, border: 'none' }}>{tree.name}</h1>
                  {tree.description && <div style={{ color: P.muted, fontSize: '14px', maxWidth: '70%', margin: '0 auto 24px' }}>{tree.description}</div>}
                  <div style={{ width: '48px', height: '2px', background: P.gold, margin: '0 auto 20px' }} />
                  <div className="mono" style={{ fontSize: '11px', color: P.faint, letterSpacing: '0.5px' }}>{t('coverMeta', { persons: stats.totalPersons, generations: genGroups.length, date: printedDate })}</div>
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
                  <div style={{ color: P.muted, fontSize: '12px', marginBottom: '8px' }}>{tree.description}</div>
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
                    <div key={s.lbl} style={{ background: P.panel, border: `1px solid ${P.border}`, padding: '14px 10px', textAlign: 'center' }}>
                      <div className="serif" style={{ fontSize: '28px', fontWeight: 700, color: P.gold, lineHeight: 1 }}>{s.val}</div>
                      <div className="mono" style={{ fontSize: '9px', color: P.faint, textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: '6px' }}>{s.lbl}</div>
                    </div>
                  ))}
                </div>

                <h2 className="serif" style={{ fontSize: '16px', color: P.ink, borderBottom: `1px solid ${P.border}`, paddingBottom: '6px', marginBottom: '14px' }}>
                  {t('allPersons')}
                </h2>
                <div style={{ columns: 2, columnGap: '20px' }}>
                  {sortedPersons.map(p => (
                    <div key={p.id} style={{ breakInside: 'avoid', marginBottom: '5px', fontSize: '12px', padding: '3px 0', display: 'flex', alignItems: 'center', gap: '6px', opacity: p.isAlive ? 1 : 0.7 }}>
                      <GenderDot g={p.gender} />
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
                            {p.events.map(e => `${e.type}${e.date ? ' ' + formatYear(e.date) : ''}`).join(' · ')}
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
            <div className="mono" style={{ textAlign: 'center', marginTop: '4px', color: P.faint, fontSize: '9px', fontStyle: 'italic', opacity: 0.5 }}>
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
                <div ref={treeRef} style={{ position: 'relative', width: `${treeLayout.width}px`, height: `${treeLayout.height}px`, background: P.paper }}>
                  <svg
                    width={treeLayout.width} height={treeLayout.height}
                    viewBox={`${treeLayout.minX} ${treeLayout.minY} ${treeLayout.width} ${treeLayout.height}`}
                    style={{ position: 'absolute', top: 0, left: 0 }}
                  >
                    {treeLayout.edges.map((e, i) => (
                      <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                        stroke={e.type === 'spouse' ? P.female : '#CFC7BB'}
                        strokeWidth={e.type === 'spouse' ? 2.5 : 1.5}
                        strokeDasharray={e.type === 'spouse' ? '7,4' : 'none'}
                      />
                    ))}
                  </svg>
                  {treeLayout.nodes.map(node => {
                    const p = node.person;
                    const age = getAge(p.birthDate, p.deathDate);
                    return (
                      <div key={p.id} style={{
                        position: 'absolute',
                        left: `${node.x - treeLayout.minX}px`, top: `${node.y - treeLayout.minY}px`,
                        width: `${NODE_W}px`, height: `${NODE_H}px`,
                        background: P.paper, border: `1px solid ${P.border}`,
                        boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '0 10px 0 12px', overflow: 'hidden',
                      }}>
                        <div style={{ position: 'absolute', left: 0, top: '8px', bottom: '8px', width: '4px', background: genderColor(p.gender) }} />
                        <PrintAvatar p={p} photos={includePhotos} size={36} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="serif" style={{ fontWeight: 700, fontSize: '12px', color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.firstName}</div>
                          <div className="serif" style={{ fontSize: '11px', color: P.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.lastName}{!p.isAlive ? ' †' : ''}</div>
                          <div className="mono" style={{ fontSize: '9px', color: P.faint }}>
                            {p.birthDate ? `✦ ${formatYear(p.birthDate)}` : ''}
                            {!p.isAlive && p.deathDate ? ` – ${formatYear(p.deathDate)}` : (age !== null && p.isAlive ? ` · ${formatAge(age)}` : '')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
