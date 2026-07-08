'use client';
import { useOverlay } from '@/hooks/useOverlay';
import { useState, useRef } from 'react';
import { FamilyTree, Person, Relationship } from '@/types';
import { exportGEDCOM } from '@/lib/treeUtils';
import { parseGEDCOM } from '@/lib/gedcomParser';
import { CheckCircle2, AlertCircle, FolderOpen, X, ScanLine, Upload, Download, FileJson, Globe, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Props {
  tree: FamilyTree;
  /** Commit the import as a NEW tree (default). */
  onImport: (tree: FamilyTree) => void;
  /** Commit a merge into the CURRENT tree (in place). Falls back to onImport if absent. */
  onMerge?: (tree: FamilyTree) => void;
  onClose: () => void;
  initialTab?: 'export' | 'import';
  /** Open the OCR document scanner (closes this modal first). */
  onScanDocument?: () => void;
}

interface Preview {
  sourceName: string;
  persons: Partial<Person>[];
  relationships: Partial<Relationship>[];
  stats: { persons: number; families: number };
}

const now = () => new Date().toISOString();
const dedupKey = (p: { firstName?: string; lastName?: string; birthDate?: string }) =>
  `${(p.firstName || '').trim().toLowerCase()}|${(p.lastName || '').trim().toLowerCase()}|${(p.birthDate || '').slice(0, 4)}`;

export default function ImportExportModal({ tree, onImport, onMerge, onClose, initialTab = 'export', onScanDocument }: Props) {
  const tOcr = useTranslations('ocr');
  const tg = useTranslations('gedcom');
  const [tab, setTab] = useState<'export' | 'import'>(initialTab);
  const [importMsg, setImportMsg] = useState('');
  const [importOk, setImportOk] = useState<boolean | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mode, setMode] = useState<'new' | 'merge'>('new');
  const [dedup, setDedup] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  const exportAsJSON = () => downloadFile(JSON.stringify(tree, null, 2), `${tree.name}.suimini.json`, 'application/json');
  const exportAsGEDCOM = () => downloadFile(exportGEDCOM(tree), `${tree.name}.ged`, 'text/plain');

  // Step 1 — read + parse the file into a PREVIEW (nothing is committed yet).
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg(''); setImportOk(null); setPreview(null);
    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result as string;
      try {
        if (file.name.endsWith('.json')) {
          const imported = JSON.parse(content) as FamilyTree;
          if (!Array.isArray(imported.persons)) throw new Error('Format invalide');
          const families = (imported.relationships || []).filter(r => r.type === 'spouse').length;
          setPreview({
            sourceName: file.name.replace(/\.json$/, ''),
            persons: imported.persons, relationships: imported.relationships || [],
            stats: { persons: imported.persons.length, families },
          });
        } else if (file.name.endsWith('.ged') || file.name.endsWith('.gedcom')) {
          const parsed = parseGEDCOM(content);
          setPreview({ sourceName: file.name.replace(/\.(ged|gedcom)$/, ''), ...parsed });
        } else {
          setImportOk(false);
          setImportMsg(tg('unsupported'));
        }
      } catch (err) {
        setImportOk(false);
        setImportMsg(`${tg('error')} ${err instanceof Error ? err.message : ''}`.trim());
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // allow re-selecting the same file
  }

  // Step 2 — commit the previewed import (new tree or merge, with optional dedup).
  function confirmImport() {
    if (!preview) return;
    setProgress(15);

    const toPerson = (p: Partial<Person>): Person => ({
      createdAt: now(), updatedAt: now(), isAlive: true, gender: 'unknown',
      firstName: '?', lastName: '', ...p,
    } as Person);

    if (mode === 'merge') {
      // Map any imported person that duplicates an existing one onto the existing id,
      // so its relationships still connect instead of creating an orphan twin.
      const existingByKey = new Map<string, string>();
      if (dedup) tree.persons.forEach(p => existingByKey.set(dedupKey(p), p.id));
      const remap = new Map<string, string>();
      const freshPersons: Person[] = [];
      for (const p of preview.persons) {
        const hit = dedup ? existingByKey.get(dedupKey(p)) : undefined;
        if (hit && p.id) remap.set(p.id, hit);
        else freshPersons.push(toPerson(p));
      }
      setProgress(55);
      const rels: Relationship[] = preview.relationships.map(r => ({
        isActive: true, ...r,
        person1Id: remap.get(r.person1Id || '') || r.person1Id,
        person2Id: remap.get(r.person2Id || '') || r.person2Id,
      } as Relationship));
      const merged: FamilyTree = {
        ...tree,
        persons: [...tree.persons, ...freshPersons],
        relationships: [...tree.relationships, ...rels],
        updatedAt: now(),
      };
      setProgress(90);
      (onMerge || onImport)(merged);
      finish(freshPersons.length);
    } else {
      const newTree: FamilyTree = {
        id: '', name: preview.sourceName, createdAt: now(), updatedAt: now(),
        persons: preview.persons.map(toPerson),
        relationships: preview.relationships.map(r => ({ isActive: true, ...r } as Relationship)),
      };
      setProgress(90);
      onImport(newTree);
      finish(newTree.persons.length);
    }
  }

  function finish(count: number) {
    setProgress(100);
    setTimeout(() => {
      setProgress(null);
      setPreview(null);
      setImportOk(true);
      setImportMsg(tg('imported', { count }));
    }, 250);
  }

  const overlayRef = useOverlay(onClose);
  const TabBtn = ({ id, icon, label }: { id: 'export' | 'import'; icon: React.ReactNode; label: string }) => (
    <button onClick={() => setTab(id)} role="tab" aria-selected={tab === id}
      className={`tab ${tab === id ? 'active' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '40px' }}>
      {icon} {label}
    </button>
  );

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={overlayRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={tg('title')} className="modal" style={{ maxWidth: '500px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="serif" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><FolderOpen size={20} aria-hidden="true" /> {tg('title')}</h2>
          <button onClick={onClose} aria-label={tg('close')} className="btn btn-ghost btn-sm btn-icon"><X size={16} /></button>
        </div>

        <div className="tabs" role="tablist" aria-label={tg('title')} style={{ margin: '0 24px', paddingTop: '4px' }}>
          <TabBtn id="export" icon={<Download size={14} aria-hidden="true" />} label={tg('tabExport')} />
          <TabBtn id="import" icon={<Upload size={14} aria-hidden="true" />} label={tg('tabImport')} />
          {onScanDocument && (
            <button onClick={() => { onClose(); onScanDocument(); }} className="tab" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', minHeight: '40px' }}>
              <ScanLine size={14} aria-hidden="true" /> {tOcr('scanButton')}
            </button>
          )}
        </div>

        <div style={{ padding: '16px 24px 24px' }}>
          {tab === 'export' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                {tg.rich('exportIntro', { name: tree.name, count: tree.persons.length, b: (c) => <strong>{c}</strong> })}
              </p>
              <ExportCard icon={<FileJson size={26} aria-hidden="true" />} title="Suimini JSON" onClick={exportAsJSON}
                desc={tg('jsonDesc')} />
              <ExportCard icon={<Globe size={26} aria-hidden="true" />} title="GEDCOM (.ged)" onClick={exportAsGEDCOM}
                desc={tg('gedcomDesc')} />
            </div>
          )}

          {tab === 'import' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {!preview && (
                <>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                    {tg('importIntro')}
                  </p>
                  <button
                    onClick={() => fileRef.current?.click()}
                    style={{
                      border: '2px dashed var(--border)', borderRadius: 'var(--radius)', width: '100%',
                      padding: '32px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-muted)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-light)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-muted)'; }}
                  >
                    <Upload size={28} aria-hidden="true" style={{ color: 'var(--accent)' }} />
                    <span style={{ fontWeight: 700 }}>{tg('dropZone')}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>.json · .ged · .gedcom</span>
                  </button>
                  <input ref={fileRef} type="file" accept=".json,.ged,.gedcom" onChange={handleFileSelect} style={{ display: 'none' }} />
                </>
              )}

              {/* Preview + options before committing */}
              {preview && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ padding: '12px 14px', border: 'var(--bw) solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                    <div className="label" style={{ marginBottom: '6px' }}>{preview.sourceName}</div>
                    <div style={{ fontSize: '14px' }}>
                      <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{preview.stats.persons}</strong> {tg('persons')}
                      {' · '}
                      <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{preview.stats.families}</strong> {tg('families')}
                    </div>
                    {preview.persons.length > 0 && (
                      <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
                        {preview.persons.slice(0, 10).map((p, i) => (
                          <li key={i}>{[p.firstName, p.lastName].filter(Boolean).join(' ') || '?'}</li>
                        ))}
                        {preview.persons.length > 10 && <li>+{preview.persons.length - 10}…</li>}
                      </ul>
                    )}
                  </div>

                  <fieldset style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', margin: 0 }}>
                    <legend className="label" style={{ padding: '0 6px' }}>{tg('options')}</legend>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '32px', cursor: 'pointer' }}>
                      <input type="radio" name="imp-mode" checked={mode === 'new'} onChange={() => setMode('new')} style={{ accentColor: 'var(--accent)' }} />
                      {tg('newTreeOption')}
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '32px', cursor: 'pointer' }}>
                      <input type="radio" name="imp-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} style={{ accentColor: 'var(--accent)' }} />
                      {tg('mergeOption')} <span style={{ color: 'var(--text-light)', fontSize: '12px' }}>({tree.name})</span>
                    </label>
                    {mode === 'merge' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '32px', cursor: 'pointer', paddingLeft: '22px' }}>
                        <input type="checkbox" checked={dedup} onChange={e => setDedup(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                        {tg('duplicateOption')}
                      </label>
                    )}
                  </fieldset>

                  {progress !== null && (
                    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label={tg('tabImport')} style={{ height: '8px', background: 'var(--bg-muted)', borderRadius: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', transition: 'width 200ms ease' }} />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => { setPreview(null); setProgress(null); }} className="btn btn-secondary btn-sm" disabled={progress !== null}>{tg('cancel')}</button>
                    <button onClick={confirmImport} className="btn btn-primary btn-sm" style={{ gap: '6px' }} disabled={progress !== null}>
                      {progress !== null ? tg('importing') : <>{tg('confirm')} <ArrowRight size={14} aria-hidden="true" /></>}
                    </button>
                  </div>
                </div>
              )}

              {importMsg && (
                <div role="status" style={{
                  padding: '12px', borderRadius: 'var(--radius)', background: 'var(--bg-muted)',
                  border: `1.5px solid ${importOk ? 'var(--success)' : 'var(--danger)'}`,
                  fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)',
                }}>
                  {importOk ? <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} aria-hidden="true" /> : <AlertCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} aria-hidden="true" />}
                  {importMsg}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExportCard({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', width: '100%',
        cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'center', textAlign: 'left',
        background: 'var(--bg-card)', color: 'var(--text)',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-light)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
    >
      <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{icon}</span>
      <span>
        <span style={{ fontWeight: 700, display: 'block' }}>{title}</span>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{desc}</span>
      </span>
    </button>
  );
}
