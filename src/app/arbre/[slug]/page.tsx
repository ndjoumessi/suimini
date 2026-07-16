import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerAuth } from '@/lib/data/apiAuth';
import { getDataStore } from '@/lib/data/dataStore';
import PublicTreeView from '@/components/PublicTreeView';

// Always render dynamically so is_public/public_slug is re-checked on every
// request: flipping a tree back to private (or rotating its slug) takes effect
// immediately, with no stale public snapshot lingering in an ISR cache.
export const dynamic = 'force-dynamic';

// F1 fix : cette page tournait en dur sur `loadPublicTree` de supabaseSync.ts
// (Supabase-direct), donc 404ait pour tout arbre créé/rendu public depuis le
// cutover Railway (les lignes vivent désormais sur Railway, jamais lues).
// Résolution DIRECTE côté serveur via `getDataStore(client, null)` (même
// frontière backend-agnostique que les routes /api/data/*, pas besoin d'un
// aller-retour HTTP puisque cette page est déjà server-only) — anonyme par
// nature (lien public, aucune session requise). `cache()` déduplique les 2
// appels de cette requête (generateMetadata + le composant page lui-même).
const loadPublicTreeForRequest = cache(async (slug: string) => {
  const { client } = await getServerAuth();
  if (!client) return null;
  const store = await getDataStore(client, null);
  return store.loadPublicTree(slug);
});

interface PageProps { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tree = await loadPublicTreeForRequest(slug);
  if (!tree) return { title: 'Arbre introuvable | Suimini', robots: { index: false, follow: false } };
  const title = `${tree.name} | Arbre généalogique | Suimini`;
  const description = `Découvrez l'arbre généalogique « ${tree.name} » (${tree.persons.length} personne${tree.persons.length > 1 ? 's' : ''}), partagé via Suimini.`;
  const url = `https://suimini.vercel.app/arbre/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: 'Suimini', type: 'website', locale: 'fr_FR' },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
  };
}

export default async function PublicTreePage({ params }: PageProps) {
  const { slug } = await params;
  const tree = await loadPublicTreeForRequest(slug);
  if (!tree) notFound();
  return <PublicTreeView tree={tree} />;
}
