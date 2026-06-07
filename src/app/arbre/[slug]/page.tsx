import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadPublicTree } from '@/lib/supabaseSync';
import PublicTreeView from '@/components/PublicTreeView';

// ISR: revalidate the public snapshot hourly.
export const revalidate = 3600;

interface PageProps { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tree = await loadPublicTree(slug);
  if (!tree) return { title: 'Arbre introuvable — Suimini', robots: { index: false, follow: false } };
  const title = `${tree.name} — Arbre généalogique | Suimini`;
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
  const tree = await loadPublicTree(slug);
  if (!tree) notFound();
  return <PublicTreeView tree={tree} />;
}
