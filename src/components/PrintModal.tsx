'use client';
import { useOverlay } from '@/hooks/useOverlay';
import { useState, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { FamilyTree } from '@/types';
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
      pdf.setTextColor(139, 111, 71);
      pdf.text(tree.name, pageW / 2, 14, { align: 'center' });

      // Tree image
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', imgX, imgY, imgW, imgH);

      // Footer
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(120, 120, 120);
      pdf.text(
        t('pdfFooter', { count: tree.persons.length, date: new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR') }),
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

  function genderColorHex(g: string) {
    return g === 'male' ? '#2c5f8a' : g === 'female' ? '#a8456b' : '#6e6a62';
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
        <title>${tree.name} — Suimini</title>
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600;700;800&family=Hanken+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Hanken Grotesk', sans-serif; font-size: 11pt; color: #1b1b1b; background: white; padding: 20mm; }
          h1 { font-family: 'Bricolage Grotesque', sans-serif; font-size: 24pt; color: #bf4b2c; margin-bottom: 6pt; }
          h2 { font-family: 'Bricolage Grotesque', sans-serif; font-size: 14pt; color: #1b1b1b; margin: 16pt 0 6pt; border-bottom: 1pt solid #d8d2c6; padding-bottom: 4pt; }
          h3 { font-family: 'Bricolage Grotesque', sans-serif; font-size: 11pt; }
          .header { text-align: center; margin-bottom: 20pt; padding-bottom: 12pt; border-bottom: 2pt solid #bf4b2c; }
          .subtitle { color: #4a4742; font-size: 10pt; margin-top: 4pt; }
          .stats-row { display: flex; gap: 16pt; justify-content: center; margin-top: 10pt; font-size: 9pt; color: #4a4742; }
          .stat { text-align: center; }
          .stat-val { font-size: 16pt; font-weight: 700; color: #bf4b2c; display: block; }
          
          /* List mode */
          .person-row { display: flex; gap: 10pt; align-items: flex-start; padding: 8pt 0; border-bottom: 0.5pt solid #ece7dc; page-break-inside: avoid; }
          .avatar { width: 36pt; height: 36pt; border-radius: 50%; overflow: hidden; flex-shrink: 0; background: #ece7dc; display: flex; align-items: center; justify-content: center; font-size: 16pt; border: 1.5pt solid #d8d2c6; }
          .avatar img { width: 100%; height: 100%; object-fit: cover; }
          .person-info { flex: 1; }
          .person-name { font-weight: 700; font-size: 11pt; }
          .person-maiden { font-weight: 400; color: #4a4742; font-size: 9pt; }
          .person-detail { font-size: 9pt; color: #4a4742; margin-top: 1pt; }
          .person-bio { font-size: 8.5pt; color: #6e6a62; margin-top: 2pt; font-style: italic; }
          .gender-m { border-left: 3pt solid #2c5f8a; padding-left: 6pt; }
          .gender-f { border-left: 3pt solid #a8456b; padding-left: 6pt; }
          .deceased { opacity: 0.75; }
          
          /* Cards mode */
          .cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12pt; }
          .person-card { border: 1pt solid #d8d2c6; border-radius: 6pt; padding: 10pt; page-break-inside: avoid; }
          .person-card.gender-m { border-top: 3pt solid #2c5f8a; }
          .person-card.gender-f { border-top: 3pt solid #a8456b; }
          .card-header { display: flex; gap: 8pt; align-items: center; margin-bottom: 8pt; }
          .card-dates { display: grid; grid-template-columns: 1fr 1fr; gap: 4pt; }
          .date-block { background: #f4f1ea; padding: 4pt 6pt; border-radius: 3pt; font-size: 8.5pt; }
          .date-label { font-size: 7.5pt; color: #6e6a62; text-transform: uppercase; letter-spacing: 0.5pt; }
          
          /* Summary */
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10pt; margin: 12pt 0; }
          .summary-card { background: #f4f1ea; border-radius: 6pt; padding: 10pt; text-align: center; }
          .summary-card .val { font-size: 22pt; font-weight: 700; color: #bf4b2c; font-family: 'Bricolage Grotesque', sans-serif; }
          .summary-card .lbl { font-size: 8pt; color: #4a4742; text-transform: uppercase; letter-spacing: 0.5pt; }
          
          .ornament { text-align: center; color: #bf4b2c; font-family: 'Bricolage Grotesque', sans-serif; font-size: 14pt; letter-spacing: 6pt; margin: 12pt 0; }
          
          @media print {
            body { padding: 10mm; }
            @page { margin: 10mm; }
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
                color: mode === m ? 'white' : 'var(--text-muted)',
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

        {/* Print preview */}
        <div style={{ padding: '20px 24px', maxHeight: 'calc(90vh - 160px)', overflowY: 'auto', background: '#ece7dc' }}>
          <div ref={printRef} style={{ background: 'white', padding: '24px', borderRadius: '4px', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', display: mode === 'tree' ? 'none' : 'block' }}>
            {/* Livret de famille : couverture + une section par génération.
                Styles INLINE + couleurs littérales → rendu correct en aperçu ET
                dans la fenêtre d'impression (qui n'a ni nos classes ni nos var()). */}
            {mode === 'livret' && (
              <div>
                <div style={{ minHeight: '560px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', border: '3px solid #1b1b1b', padding: '40px', pageBreakAfter: 'always' }}>
                  <div className="serif" style={{ textTransform: 'uppercase', letterSpacing: '4px', fontSize: '12px', color: '#bf4b2c', marginBottom: '16px' }}>{t('livretCover')}</div>
                  <h1 className="serif" style={{ fontSize: '40px', color: '#1b1b1b', margin: '0 0 14px', lineHeight: 1.05, border: 'none' }}>{tree.name}</h1>
                  {tree.description && <div style={{ color: '#4a4742', fontSize: '14px', maxWidth: '70%', margin: '0 auto 24px' }}>{tree.description}</div>}
                  <div className="serif" style={{ fontSize: '12px', color: '#6e6a62', letterSpacing: '1px' }}>{t('coverMeta', { persons: stats.totalPersons, generations: genGroups.length, date: new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) })}</div>
                </div>
                {genGroups.map(({ gen, people }) => (
                  <div key={gen} style={{ pageBreakBefore: 'always', marginTop: '24px' }}>
                    <h2 className="serif" style={{ fontSize: '20px', color: '#1b1b1b', borderBottom: '2px solid #bf4b2c', paddingBottom: '4px', margin: '0 0 14px' }}>{t('generation', { n: gen + 1 })}</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {people.map(p => (
                        <div key={p.id} style={{ display: 'flex', gap: '10px', padding: '10px', border: '1.5px solid #1b1b1b', borderLeft: `4px solid ${p.gender === 'male' ? '#2c5f8a' : p.gender === 'female' ? '#a8456b' : '#1b1b1b'}`, pageBreakInside: 'avoid', opacity: p.isAlive ? 1 : 0.85 }}>
                          {includePhotos && p.profilePhoto && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.profilePhoto} alt="" style={{ width: '56px', height: '56px', flexShrink: 0, objectFit: 'cover', border: '1.5px solid #1b1b1b', background: '#f4f1ea' }} />
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div className="serif" style={{ fontWeight: 700, fontSize: '14px', color: '#1b1b1b' }}>{getDisplayName(p)}{!p.isAlive ? ' †' : ''}</div>
                            {(p.birthDate || p.birthPlace?.city) && (
                              <div style={{ fontSize: '11px', color: '#4a4742', marginTop: '2px' }}>
                                {p.birthDate ? t('bornOn', { gender: p.gender, date: formatDate(p.birthDate, p.birthDateApprox) }) : ''}{p.birthPlace?.city ? t('inPlace', { place: p.birthPlace.city }) : ''}
                              </div>
                            )}
                            {!p.isAlive && p.deathDate && <div style={{ fontSize: '11px', color: '#4a4742', marginTop: '2px' }}>{t('diedOn', { gender: p.gender, date: formatDate(p.deathDate, p.deathDateApprox) })}{p.deathPlace?.city ? t('inPlace', { place: p.deathPlace.city }) : ''}</div>}
                            {p.occupation && <div style={{ fontSize: '11px', color: '#4a4742', marginTop: '2px' }}>{p.occupation}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Header (autres modes) */}
            {mode !== 'livret' && (
            <div className="header" style={{ textAlign: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '2px solid #bf4b2c' }}>
              <h1 className="serif" style={{ fontSize: '1.8rem', color: 'var(--accent)', margin: '0 0 4px' }}>
                {tree.name}
              </h1>
              {tree.description && (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>{tree.description}</div>
              )}
              <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '10px', fontSize: '12px', color: 'var(--text-light)' }}>
                <span>{t('headerPersons', { count: stats.totalPersons })}</span>
                <span>{t('headerGenerations', { count: stats.totalGenerations })}</span>
                <span>{t('printedOn', { date: new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR') })}</span>
              </div>
            </div>
            )}

            {mode === 'summary' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
                  {[
                    { val: stats.totalPersons, lbl: t('statPersons') },
                    { val: stats.totalAlive, lbl: t('statAlive') },
                    { val: stats.totalGenerations, lbl: t('statGenerations') },
                    { val: stats.totalRelationships, lbl: t('statRelationships') },
                  ].map(s => (
                    <div key={s.lbl} style={{ background: 'var(--bg-muted)', borderRadius: 'var(--radius)', padding: '12px', textAlign: 'center' }}>
                      <div className="serif" style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--accent)' }}>{s.val}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.lbl}</div>
                    </div>
                  ))}
                </div>

                <h2 className="serif" style={{ fontSize: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '12px' }}>
                  {t('allPersons')}
                </h2>
                <div style={{ columns: 2, gap: '16px' }}>
                  {sortedPersons.map(p => (
                    <div key={p.id} style={{ breakInside: 'avoid', marginBottom: '4px', fontSize: '12px', padding: '3px 6px', background: p.isAlive ? 'transparent' : 'var(--bg-muted)', borderRadius: '3px' }}>
                      <strong>{p.lastName}</strong>, {p.firstName}
                      {p.birthDate && <span style={{ color: 'var(--text-muted)' }}> · {formatYear(p.birthDate)}</span>}
                      {!p.isAlive && <span style={{ color: 'var(--deceased)' }}> †</span>}
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
                      padding: '10px 0', borderBottom: '1px solid var(--border)',
                      opacity: p.isAlive ? 1 : 0.8,
                      borderLeft: `4px solid ${p.gender === 'male' ? 'var(--male)' : p.gender === 'female' ? 'var(--female)' : 'var(--border)'}`,
                      paddingLeft: '10px',
                    }}>
                      {includePhotos && (
                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                          {p.profilePhoto ? <img src={p.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.gender === 'male' ? '👨' : p.gender === 'female' ? '👩' : '🧑')}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', fontSize: '14px' }}>
                          {p.firstName} {p.maidenName ? `(${p.maidenName}) ` : ''}{p.lastName}
                          {!p.isAlive && <span style={{ color: 'var(--deceased)', fontSize: '12px', marginLeft: '6px' }}>†</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {p.occupation && <span>{p.occupation} · </span>}
                          {p.birthDate && <span>{t('bornShort', { date: formatDate(p.birthDate) })}</span>}
                          {p.birthPlace?.city && <span>{t('inPlace', { place: p.birthPlace.city })}</span>}
                          {!p.isAlive && p.deathDate && <span> · {t('diedShort', { date: formatDate(p.deathDate) })}</span>}
                          {age !== null && <span> ({formatAge(age)})</span>}
                        </div>
                        {p.bio && <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '3px', fontStyle: 'italic' }}>{p.bio.slice(0, 150)}{p.bio.length > 150 ? '…' : ''}</div>}
                        {includeEvents && p.events && p.events.length > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '3px' }}>
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
                      border: `1px solid var(--border)`,
                      borderTop: `3px solid ${p.gender === 'male' ? 'var(--male)' : p.gender === 'female' ? 'var(--female)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius)', padding: '12px',
                      opacity: p.isAlive ? 1 : 0.8,
                    }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                        {includePhotos && (
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                            {p.profilePhoto ? <img src={p.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.gender === 'male' ? '👨' : p.gender === 'female' ? '👩' : '🧑')}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '13px' }}>{p.firstName} {p.lastName}</div>
                          {p.maidenName && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('maidenName', { name: p.maidenName })}</div>}
                          {p.occupation && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.occupation}</div>}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
                        <div style={{ background: 'var(--bg-muted)', borderRadius: '4px', padding: '5px 8px' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{t('cardBirth')}</div>
                          <div>{formatYear(p.birthDate) || '—'}</div>
                          {p.birthPlace?.city && <div style={{ color: 'var(--text-muted)' }}>{p.birthPlace.city}</div>}
                        </div>
                        <div style={{ background: 'var(--bg-muted)', borderRadius: '4px', padding: '5px 8px' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                            {p.isAlive ? t('cardAge') : t('cardDeath')}
                          </div>
                          <div>
                            {p.isAlive
                              ? (age !== null ? formatAge(age) : '—')
                              : (formatYear(p.deathDate) || '—')}
                          </div>
                          {!p.isAlive && p.deathPlace?.city && <div style={{ color: 'var(--text-muted)' }}>{p.deathPlace.city}</div>}
                        </div>
                      </div>
                      {p.bio && <div style={{ marginTop: '8px', fontSize: '10.5px', color: 'var(--text-light)', fontStyle: 'italic' }}>{p.bio.slice(0, 100)}{p.bio.length > 100 ? '…' : ''}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-light)', fontSize: '11px' }}>
              {t('docFooter', { date: new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR') })}
            </div>
          </div>

          {/* Visual tree preview (captured for PDF export) */}
          {mode === 'tree' && (
            <div style={{ overflow: 'auto', maxWidth: '100%' }}>
              {treeLayout.nodes.length === 0 ? (
                <div style={{ background: 'white', padding: '40px', borderRadius: '4px', textAlign: 'center', color: '#4a4742' }}>
                  {t('treeEmpty')}
                </div>
              ) : (
                <div ref={treeRef} style={{ position: 'relative', width: `${treeLayout.width}px`, height: `${treeLayout.height}px`, background: '#ffffff' }}>
                  <svg
                    width={treeLayout.width} height={treeLayout.height}
                    viewBox={`${treeLayout.minX} ${treeLayout.minY} ${treeLayout.width} ${treeLayout.height}`}
                    style={{ position: 'absolute', top: 0, left: 0 }}
                  >
                    {treeLayout.edges.map((e, i) => (
                      <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                        stroke={e.type === 'spouse' ? '#e090a8' : '#cfc7bb'}
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
                        background: '#ffffff', border: '1.5px solid #d8d2c6', borderRadius: '10px',
                        boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '0 10px 0 12px', overflow: 'hidden',
                      }}>
                        <div style={{ position: 'absolute', left: 0, top: '10px', bottom: '10px', width: '5px', borderRadius: '4px', background: genderColorHex(p.gender) }} />
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: p.gender === 'male' ? '#deeaf5' : p.gender === 'female' ? '#f5dde8' : '#ece7dc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                          {p.gender === 'male' ? '👨' : p.gender === 'female' ? '👩' : '🧑'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '12px', color: '#1b1b1b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.firstName}</div>
                          <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: '#4a4742', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.lastName}{!p.isAlive ? ' †' : ''}</div>
                          <div style={{ fontFamily: 'var(--font-body)', fontSize: '9.5px', color: '#6e6a62' }}>
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
