import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

export const metadata = {
  title: "Conditions générales d'utilisation | Suimini",
  description:
    "Conditions générales d'utilisation de Suimini : accès au service, compte, données généalogiques, propriété intellectuelle, abonnements, résiliation et droit applicable.",
};

const sections: { title: string; content: ReactNode }[] = [
  {
    title: 'Objet',
    content: (
      <p style={{ margin: 0 }}>
        Les présentes conditions régissent l&apos;utilisation de <strong>Suimini</strong>, un
        service de généalogie numérique accessible à l&apos;adresse{' '}
        <strong>suimini.vercel.app</strong>. En utilisant le service, vous acceptez sans réserve les
        présentes conditions.
      </p>
    ),
  },
  {
    title: 'Accès au service',
    content: (
      <>
        <p style={{ margin: '0 0 12px' }}>
          Le service est <strong>gratuit</strong> pour un usage personnel. Une inscription est
          requise pour accéder aux fonctionnalités connectées.
        </p>
        <p style={{ margin: 0 }}>
          Le plan gratuit donne droit à <strong>un arbre</strong> ; un nombre{' '}
          <strong>illimité</strong> d&apos;arbres est disponible avec un abonnement.
        </p>
      </>
    ),
  },
  {
    title: 'Compte utilisateur',
    content: (
      <>
        <p style={{ margin: '0 0 12px' }}>
          La création d&apos;un compte nécessite une <strong>adresse email valide</strong>. Vous
          êtes responsable de l&apos;exactitude et de la légalité des données que vous saisissez.
        </p>
        <p style={{ margin: 0 }}>
          Il est <strong>interdit</strong> d&apos;enregistrer des données concernant des tiers sans
          leur accord.
        </p>
      </>
    ),
  },
  {
    title: 'Données généalogiques',
    content: (
      <>
        <p style={{ margin: '0 0 12px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <AlertTriangle size={16} aria-hidden="true" style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '3px' }} />
          <span>Les arbres généalogiques peuvent contenir des <strong>données sensibles</strong>{' '}
          (origines, données de santé, etc.).</span>
        </p>
        <p style={{ margin: '0 0 12px' }}>
          L&apos;utilisateur est seul <strong>responsable du contenu</strong> qu&apos;il publie.
        </p>
        <p style={{ margin: 0 }}>
          Tout partage de données suppose le <strong>consentement</strong> préalable des personnes
          concernées.
        </p>
      </>
    ),
  },
  {
    title: 'Propriété intellectuelle',
    content: (
      <>
        <p style={{ margin: '0 0 12px' }}>
          Le service, son code et son interface appartiennent à <strong>Suimini</strong>.
        </p>
        <p style={{ margin: '0 0 12px' }}>
          Les <strong>données généalogiques</strong> que vous saisissez restent votre propriété.
        </p>
        <p style={{ margin: 0 }}>
          Suimini vous concède une simple <strong>licence d&apos;utilisation</strong> du service.
        </p>
      </>
    ),
  },
  {
    title: 'Abonnements et tarifs',
    content: (
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        <li style={{ marginBottom: 6 }}>
          <strong>Gratuit</strong> — 1 arbre, 50 personnes.
        </li>
        <li style={{ marginBottom: 6 }}>
          <strong>Famille</strong> — 9 €/mois, arbres illimités.
        </li>
        <li style={{ marginBottom: 0 }}>
          <strong>Pro</strong> — 19 €/mois, IA avancée et collaboration.
        </li>
      </ul>
    ),
  },
  {
    title: 'Résiliation',
    content: (
      <>
        <p style={{ margin: '0 0 12px' }}>
          Vous pouvez résilier votre abonnement <strong>librement, à tout moment</strong>.
        </p>
        <p style={{ margin: '0 0 12px' }}>
          L&apos;<strong>export de vos données</strong> est garanti au format GEDCOM.
        </p>
        <p style={{ margin: 0 }}>
          Vos données sont <strong>supprimées sous 30 jours</strong> après la résiliation.
        </p>
      </>
    ),
  },
  {
    title: 'Limitation de responsabilité',
    content: (
      <p style={{ margin: 0 }}>
        Le service est fourni « <strong>en l&apos;état</strong> ». Suimini ne garantit pas une
        disponibilité 24/7 et ne saurait être tenu responsable des interruptions ou pertes de
        données. Nous vous recommandons d&apos;exporter régulièrement vos arbres.
      </p>
    ),
  },
  {
    title: 'Droit applicable',
    content: (
      <p style={{ margin: 0 }}>
        Les présentes conditions sont soumises au <strong>droit français</strong>. En cas de litige,
        le <strong>tribunal compétent</strong> est celui de <strong>Paris</strong>.
      </p>
    ),
  },
  {
    title: 'Contact',
    content: (
      <p style={{ margin: 0 }}>
        Pour toute question relative aux présentes conditions :{' '}
        <a href="mailto:contact@suimini.app" style={{ color: 'var(--accent)' }}>
          contact@suimini.app
        </a>
        .
      </p>
    ),
  },
];

export default function CguPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '48px 24px',
        fontFamily: 'var(--font-body)',
        color: 'var(--text)',
      }}
    >
      <a
        href="/"
        style={{
          color: 'var(--text-muted)',
          fontSize: 13,
          fontFamily: 'var(--font-mono)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 48,
          textDecoration: 'none',
        }}
      >
        ← RETOUR
      </a>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--accent)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 8,
        }}
      >
        SUIMINI · LÉGAL
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32,
          fontWeight: 700,
          margin: '0 0 8px',
        }}
      >
        Conditions générales d&apos;utilisation
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 48px' }}>
        Dernière mise à jour : juin 2026
      </p>
      {sections.map((s, i) => (
        <section key={i} style={{ marginBottom: 40 }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 700,
              borderBottom: '2px solid var(--ink)',
              paddingBottom: 8,
              marginBottom: 16,
            }}
          >
            {i + 1}. {s.title}
          </h2>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>{s.content}</div>
        </section>
      ))}
    </main>
  );
}
