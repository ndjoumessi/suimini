import type { Metadata } from 'next';
import Landing from '@/components/landing/Landing';

export const metadata: Metadata = {
  title: 'Suimini — L’arbre généalogique moderne',
  description: "Préservez l’histoire de votre famille, génération après génération. Élégant, collaboratif et toujours avec vous.",
  alternates: { canonical: 'https://suimini.vercel.app/landing' },
};

export default function LandingPage() {
  return <Landing />;
}
