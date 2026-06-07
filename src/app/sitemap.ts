import { MetadataRoute } from 'next';

const SITE_URL = 'https://suimini.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: SITE_URL, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/landing`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/cgu`, lastModified, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/confidentialite`, lastModified, changeFrequency: 'monthly', priority: 0.3 },
  ];
}
