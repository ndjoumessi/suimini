import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Suimini — Arbre Généalogique",
  description: "Gérez l'histoire de votre famille avec Suimini, l'application d'arbre généalogique élégante et complète.",
  keywords: "arbre généalogique, famille, ancêtres, histoire familiale, genealogie",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
