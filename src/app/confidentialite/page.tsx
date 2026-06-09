import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Confidentialité | Suimini' };

export default function ConfidentialitePage() {
  return (
    <main style={{ background: 'var(--bg, #f4f1ea)', minHeight: '100dvh', color: 'var(--ink, #1b1b1b)' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: 'clamp(32px, 6vw, 72px) 24px 96px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#bf4b2c', fontWeight: 700, textDecoration: 'none', marginBottom: '28px' }}>
          <ArrowLeft size={16} /> Retour à l’accueil
        </Link>
        <h1 className="serif" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>Politique de confidentialité</h1>
        <p style={{ color: '#6e6a62', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--font-mono)', margin: '0 0 36px' }}>Dernière mise à jour : juin 2026</p>

        <Section title="1. Données collectées">
          Suimini collecte uniquement les données nécessaires au fonctionnement du service : votre adresse e-mail (pour l’authentification), le nom affiché que vous renseignez, et le contenu des arbres généalogiques que vous créez (personnes, relations, dates, lieux, photos). En mode invité, aucune donnée n’est transmise : tout reste sur votre appareil.
        </Section>
        <Section title="2. Hébergement et sécurité">
          Vos données sont hébergées en Europe (Supabase, région de Stockholm) et chiffrées en transit (SSL/TLS). L’accès à vos arbres est protégé par authentification et par des règles de sécurité au niveau de la base de données.
        </Section>
        <Section title="3. Utilisation des données">
          Vos données servent exclusivement à vous fournir le service : afficher, synchroniser et partager vos arbres. Nous ne vendons ni ne louons vos données à des tiers, et ne les utilisons pas à des fins publicitaires.
        </Section>
        <Section title="4. Partage et collaboration">
          Lorsque vous invitez des proches à collaborer sur un arbre, ils accèdent au contenu que vous partagez, selon les droits (lecture ou écriture) que vous leur accordez. Vous gardez le contrôle de ces accès à tout moment.
        </Section>
        <Section title="5. Vos droits">
          Conformément au RGPD, vous pouvez accéder à vos données, les rectifier, les exporter (JSON, GEDCOM, PDF) ou demander leur suppression. La suppression de votre compte entraîne l’effacement de vos arbres dans le cloud.
        </Section>
        <Section title="6. Contact">
          Pour toute question relative à vos données : <a href="mailto:hello@suimini.app" style={{ color: '#bf4b2c', fontWeight: 600 }}>hello@suimini.app</a>.
        </Section>

        <p style={{ marginTop: '48px', fontSize: '12px', color: '#8a8276', fontFamily: 'var(--font-mono)' }}>© 2026 Suimini · Tous droits réservés</p>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '28px' }}>
      <h2 className="serif" style={{ fontSize: '1.25rem', margin: '0 0 8px' }}>{title}</h2>
      <p style={{ margin: 0, lineHeight: 1.7, color: '#4a4742', fontSize: '15px' }}>{children}</p>
    </section>
  );
}
