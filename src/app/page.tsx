import type { Metadata } from 'next';
import HomeGate from '@/components/HomeGate';

const SITE = 'https://suimini.vercel.app';
const TITLE = 'Suimini — Préservez l’histoire de votre famille';
const DESCRIPTION = "L’arbre généalogique moderne — élégant, collaboratif et toujours avec vous. Créez votre arbre, importez du GEDCOM, explorez vos origines et partagez avec votre famille.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESCRIPTION,
  keywords: 'arbre généalogique, généalogie, famille, ancêtres, GEDCOM, histoire familiale, ADN, collaboration',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: SITE,
    siteName: 'Suimini',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/og.svg', width: 1200, height: 630, alt: 'Suimini — Arbre généalogique' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og.svg'],
  },
  alternates: { canonical: SITE },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Suimini',
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'Web',
  description: DESCRIPTION,
  url: SITE,
  offers: [
    { '@type': 'Offer', name: 'Gratuit', price: '0', priceCurrency: 'EUR' },
    { '@type': 'Offer', name: 'Famille', price: '9', priceCurrency: 'EUR' },
    { '@type': 'Offer', name: 'Pro', price: '19', priceCurrency: 'EUR' },
  ],
  aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.9', ratingCount: '128' },
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HomeGate />
    </>
  );
}
