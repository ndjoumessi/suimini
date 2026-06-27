'use client';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { FamilyTree } from '@/types';
import TreeView from './tree/TreeView';
import { BrandLockup } from './Brand';

/**
 * Read-only public render of a shared tree. No sidebar, no editing — just the
 * tree canvas under a minimal header that nudges visitors toward signing up.
 */
export default function PublicTreeView({ tree }: { tree: FamilyTree }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <header style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        padding: '12px 18px', borderBottom: 'var(--bw) solid var(--border-strong)', background: 'var(--bg-card)',
      }}>
        <Link href="/" aria-label="Accueil Suimini" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <BrandLockup size={24} color="var(--ink)" accent="var(--accent)" surface="var(--bg-card)" fontSize={18} />
          <span style={{ borderLeft: '1px solid var(--border)', paddingLeft: '12px', minWidth: 0 }}>
            <span className="label" style={{ fontSize: '9px', color: 'var(--text-light)' }}>Arbre partagé</span>
            <span style={{ display: 'block', fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50vw' }}>{tree.name}</span>
          </span>
        </Link>
        <Link href="/" className="btn btn-primary btn-sm" style={{ gap: '7px', textDecoration: 'none', flexShrink: 0 }}>
          Voir en détail <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <TreeView
          tree={tree}
          selectedPersonId={null}
          onSelectPerson={() => {}}
          onAddPerson={() => {}}
          readOnly
        />
      </main>
    </div>
  );
}
