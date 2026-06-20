'use client';
import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useOverlay } from '@/hooks/useOverlay';
import { FileDown, X } from 'lucide-react';
import type { FamilyTree } from '@/types';
import {
  generateFamilyBookHTML,
  estimatePageCount,
  type ExportOptions,
} from '@/lib/pdfTemplates';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface Props {
  tree: FamilyTree;
  onClose: () => void;
}

type Step = 'data' | 'layout' | 'render' | 'done';

const PAPER_SIZES: ExportOptions['paperSize'][] = ['A4', 'A5', 'Letter'];
const THEMES: ExportOptions['theme'][] = ['atelier', 'classic', 'minimal'];

export default function ExportPDFModal({ tree, onClose }: Props) {
  const t = useTranslations('pdf');
  const locale = useLocale();
  const overlayRef = useOverlay(onClose);

  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeBios, setIncludeBios] = useState(true);
  const [includeTimeline, setIncludeTimeline] = useState(true);
  const [paperSize, setPaperSize] = useState<ExportOptions['paperSize']>('A4');
  const [theme, setTheme] = useState<ExportOptions['theme']>('atelier');

  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState<Step>('data');
  const [error, setError] = useState<string | null>(null);

  const options: ExportOptions = { includePhotos, includeBios, includeTimeline, paperSize, theme };
  const pageCount = estimatePageCount(tree, options);

  const stepLabel: Record<Step, string> = {
    data: t('stepData'),
    layout: t('stepLayout'),
    render: t('stepRender'),
    done: t('stepDone'),
  };

  const themeLabel: Record<ExportOptions['theme'], string> = {
    atelier: t('themeAtelier'),
    classic: t('themeClassic'),
    minimal: t('themeMinimal'),
  };

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      // Staged progress for perceived responsiveness.
      setStep('data');
      await delay(250);
      setStep('layout');
      const html = generateFamilyBookHTML(tree, options, locale);
      await delay(300);
      setStep('render');
      await delay(250);

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        setError(t('error'));
        setGenerating(false);
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setStep('done');
      setTimeout(() => {
        try {
          printWindow.print();
        } catch {
          /* user may close the window before print resolves */
        }
      }, 500);
      // Leave the modal in a "done" state briefly, then close.
      setTimeout(() => {
        setGenerating(false);
        onClose();
      }, 900);
    } catch {
      setError(t('error'));
      setGenerating(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={overlayRef} tabIndex={-1} className="modal" style={{ maxWidth: '560px', maxHeight: '90vh' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="serif" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileDown size={20} aria-hidden="true" /> {t('title')}
          </h2>
          <button onClick={onClose} aria-label={t('cancel')} className="btn btn-ghost btn-sm btn-icon"><X size={16} /></button>
        </div>

        <div style={{ padding: '20px 24px', overflowY: 'auto', maxHeight: 'calc(90vh - 150px)' }}>
          {/* Content toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
            <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '14px', cursor: 'pointer' }}>
              <input type="checkbox" checked={includePhotos} onChange={(e) => setIncludePhotos(e.target.checked)} disabled={generating} />
              {t('includePhotos')}
            </label>
            <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '14px', cursor: 'pointer' }}>
              <input type="checkbox" checked={includeBios} onChange={(e) => setIncludeBios(e.target.checked)} disabled={generating} />
              {t('includeBios')}
            </label>
            <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '14px', cursor: 'pointer' }}>
              <input type="checkbox" checked={includeTimeline} onChange={(e) => setIncludeTimeline(e.target.checked)} disabled={generating} />
              {t('includeTimeline')}
            </label>
          </div>

          {/* Paper size */}
          <div style={{ marginBottom: '18px' }}>
            <div className="label" style={{ fontSize: '10px', marginBottom: '6px' }}>{t('paperSize')}</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {PAPER_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => setPaperSize(size)}
                  disabled={generating}
                  className="btn btn-sm"
                  style={{
                    flex: 1,
                    background: paperSize === size ? 'var(--accent)' : 'var(--bg-card)',
                    color: paperSize === size ? 'white' : 'var(--text-muted)',
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div style={{ marginBottom: '18px' }}>
            <div className="label" style={{ fontSize: '10px', marginBottom: '6px' }}>{t('theme')}</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {THEMES.map((th) => (
                <button
                  key={th}
                  onClick={() => setTheme(th)}
                  disabled={generating}
                  className="btn btn-sm"
                  style={{
                    flex: 1,
                    background: theme === th ? 'var(--accent)' : 'var(--bg-card)',
                    color: theme === th ? 'white' : 'var(--text-muted)',
                  }}
                >
                  {themeLabel[th]}
                </button>
              ))}
            </div>
          </div>

          {/* Page count preview */}
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: error ? '14px' : '0' }}>
            {t('pages', { count: pageCount })}
          </div>

          {error && (
            <div style={{ marginTop: '14px' }}>
              <ErrorMessage message={error} onRetry={handleGenerate} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          {generating ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <LoadingSpinner size={16} /> {stepLabel[step]}
            </span>
          ) : (
            <span />
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} disabled={generating} className="btn btn-secondary btn-sm">{t('cancel')}</button>
            <button onClick={handleGenerate} disabled={generating} className="btn btn-primary btn-sm">
              <FileDown size={14} /> {t('generate')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
