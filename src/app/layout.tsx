import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";

// Atelier type system — distinctive, self-hosted via next/font (no FOUT, no render-blocking @import).
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-mono", display: "swap" });

const SITE_URL = "https://suimini.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Suimini | Arbre Généalogique",
  description:
    "Préservez l'histoire de votre famille, génération après génération. Créez votre arbre généalogique en ligne, collaboratif et élégant.",
  keywords: "arbre généalogique, généalogie, famille, ancêtres, histoire familiale, GEDCOM",
  authors: [{ name: "Suimini" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Suimini",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    title: "Suimini | Arbre Généalogique",
    description: "Préservez l'histoire de votre famille",
    url: SITE_URL,
    siteName: "Suimini",
    images: [{ url: `${SITE_URL}/og.png`, width: 1200, height: 630, alt: "Suimini, arbre généalogique" }],
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Suimini | Arbre Généalogique",
    description: "Préservez l'histoire de votre famille",
    images: [`${SITE_URL}/og.png`],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
};

export const viewport: Viewport = {
  themeColor: "#f4f1ea",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

// Origin of the Supabase project (auth + data), preconnected for faster first call.
const SUPABASE_ORIGIN = (() => {
  try { return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : null; }
  catch { return null; }
})();

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Locale comes from the cookie (no URL routing). Messages are provided to the
  // whole tree so every client component can call useTranslations().
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        {/* next/font self-hosts the fonts, so we only hint at the runtime origins we actually hit. */}
        {SUPABASE_ORIGIN && <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="anonymous" />}
        {SUPABASE_ORIGIN && <link rel="dns-prefetch" href={SUPABASE_ORIGIN} />}
        {/* Avatar/illustration CDN used on the landing & sample data. */}
        <link rel="dns-prefetch" href="https://api.dicebear.com" />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').catch(function (err) {
                    console.error('SW registration failed:', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
