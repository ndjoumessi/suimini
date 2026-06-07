import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/app', '/app/', '/profil'],
    },
    sitemap: 'https://suimini.vercel.app/sitemap.xml',
  };
}
