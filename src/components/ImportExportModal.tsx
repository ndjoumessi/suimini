'use client';
import { useState, useRef } from 'react';
import { FamilyTree } from '@/types';
import { exportGEDCOM, importGEDCOM } from '@/lib/treeUtils';

interface Props {
  tree: FamilyTree;
  onImport: (tree: FamilyTree) => void;
  onClose: () => void;
}

export default function ImportExportModal({ tree, onImport, onClose }: Props) {
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function exportAsJSON() {
    downloadFile(JSON.stringify(tree, null, 2), `${tree.name}.suimini.json`, 'application/json');
  }

  function exportAsGEDCOM() {
    downloadFile(exportGEDCOM(tree), `${tree.name}.ged`, 'text/plain');
  }

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg('');

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      try {
        if (file.name.endsWith('.json')) {
          const imported = JSON.parse(content) as FamilyTree;
          if (!imported.persons || !Array.isArray(imported.persons)) throw new Error('Format invalide');
          onImport(imported);
          setImportMsg(`✅ Importé : ${imported.persons.length} personnes`);
        } else if (file.name.endsWith('.ged') || file.name.endsWith('.gedcom')) {
          const partial = importGEDCOM(content);
          const newTree: FamilyTree = {
            id: '', name: file.name.replace(/\.(ged|gedcom)$/, ''),
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            persons: partial.persons || [], relationships: partial.relationships || [],
          };
          onImport(newTree);
          setImportMsg(`✅ Importé depuis GEDCOM : ${newTree.persons.length} personnes`);
        } else {
          setImportMsg('❌ Format non supporté (.json, .ged, .gedcom)');
        }
      } catch (err) {
        setImportMsg(`❌ Erreur : ${err instanceof Error ? err.message : 'Fichier invalide'}`);
      }
      setImporting(false);
    };
    reader.readAsText(file);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '480px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="serif" style={{ margin: 0 }}>📁 Import / Export</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>

        <div className="tabs" style={{ margin: '0 24px', paddingTop: '4px' }}>
          <button onClick={() => setTab('export')} className={`tab ${tab === 'export' ? 'active' : ''}`}>📤 Exporter</button>
          <button onClick={() => setTab('import')} className={`tab ${tab === 'import' ? 'active' : ''}`}>📥 Importer</button>
        </div>

        <div style={{ padding: '16px 24px 24px' }}>
          {tab === 'export' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                Exportez votre arbre <strong>{tree.name}</strong> ({tree.persons.length} personnes) dans l&apos;un des formats suivants :
              </p>

              <div
                onClick={exportAsJSON}
                style={{ 
                  padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  cursor: 'pointer', transition: 'all 0.15s', display: 'flex', gap: '12px', alignItems: 'center'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-light)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = ''; }}
              >
                <span style={{ fontSize: '32px' }}>📄</span>
                <div>
                  <div style={{ fontWeight: '700' }}>Suimini JSON</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Format natif, toutes les données préservées. Recommandé pour les sauvegardes.</div>
                </div>
              </div>

              <div
                onClick={exportAsGEDCOM}
                style={{ 
                  padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  cursor: 'pointer', transition: 'all 0.15s', display: 'flex', gap: '12px', alignItems: 'center'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-light)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = ''; }}
              >
                <span style={{ fontSize: '32px' }}>🌐</span>
                <div>
                  <div style={{ fontWeight: '700' }}>GEDCOM (.ged)</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Standard universel. Compatible avec Ancestry, MyHeritage, Généatique, etc.</div>
                </div>
              </div>
            </div>
          )}

          {tab === 'import' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                Importez un arbre depuis un fichier. Les formats supportés : <strong>.json</strong> (Suimini), <strong>.ged / .gedcom</strong> (GEDCOM standard).
              </p>

              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
                  padding: '32px', textAlign: 'center', cursor: 'pointer',
                  transition: 'all 0.15s', background: 'var(--bg-muted)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-light)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-muted)'; }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
                <div style={{ fontWeight: '700', marginBottom: '4px' }}>
                  {importing ? 'Import en cours...' : 'Cliquez pour sélectionner un fichier'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>.json · .ged · .gedcom</div>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept=".json,.ged,.gedcom"
                onChange={handleFileImport}
                style={{ display: 'none' }}
              />

              {importMsg && (
                <div style={{
                  padding: '12px', borderRadius: 'var(--radius)',
                  background: importMsg.startsWith('✅') ? '#f0faf4' : '#fdf2f2',
                  border: `1px solid ${importMsg.startsWith('✅') ? '#a8d8b9' : '#f5c6c6'}`,
                  fontSize: '14px'
                }}>
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
