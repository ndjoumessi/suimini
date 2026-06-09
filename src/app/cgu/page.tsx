import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Conditions générales | Suimini' };

export default function CguPage() {
  return (
    <main style={{ background: 'var(--bg, #f4f1ea)', minHeight: '100dvh', color: 'var(--ink, #1b1b1b)' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: 'clamp(32px, 6vw, 72px) 24px 96px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#bf4b2c', fontWeight: 700, textDecoration: 'none', marginBottom: '28px' }}>
          <ArrowLeft size={16} /> Retour à l’accueil
        </Link>
        <h1 className="serif" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>Conditions générales d’utilisation</h1>
        <p style={{ color: '#6e6a62', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--font-mono)', margin: '0 0 36px' }}>Dernière mise à jour : juin 2026</p>

        <Section title="1. Objet">
          Les présentes conditions régissent l’utilisation de Suimini, application de création et de partage d’arbres généalogiques. En utilisant le service, vous acceptez ces conditions.
        </Section>
        <Section title="2. Compte">
          La création d’un compte nécessite une adresse e-mail valide. Vous êtes responsable de la confidentialité de votre accès et des activités effectuées depuis votre compte. Un usage en mode invité, sans compte, est possible avec stockage local uniquement.
        </Section>
        <Section title="3. Contenu et propriété">
          Vous restez propriétaire des données que vous saisissez. Vous garantissez disposer des droits nécessaires sur les informations et photos ajoutées, notamment concernant les personnes vivantes mentionnées dans vos arbres.
        </Section>
        <Section title="4. Usage acceptable">
          Vous vous engagez à ne pas utiliser Suimini à des fins illicites, à ne pas porter atteinte aux droits de tiers, et à ne pas tenter de compromettre la sécurité ou l’intégrité du service.
        </Section>
        <Section title="5. Offres et abonnements">
          Le plan Gratuit est accessible sans engagement. Les plans payants (Famille, Pro) débloquent des fonctionnalités supplémentaires, facturées selon la périodicité indiquée et résiliables à tout moment.
        </Section>
        <Section title="6. Disponibilité et responsabilité">
          Le service est fourni « en l’état ». Nous nous efforçons d’assurer sa disponibilité et la sauvegarde de vos données, sans garantie d’absence d’interruption. Nous vous recommandons d’exporter régulièrement vos arbres.
        </Section>
        <Section title="7. Contact">
          Pour toute question relative aux présentes conditions : <a href="mailto:hello@suimini.app" style={{ color: '#bf4b2c', fontWeight: 600 }}>hello@suimini.app</a>.
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
