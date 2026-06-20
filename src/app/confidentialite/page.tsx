import type { ReactNode } from 'react';

export const metadata = {
  title: 'Politique de confidentialité | Suimini',
  description:
    "Politique de confidentialité de Suimini : données collectées, finalités, base légale, durées de conservation, droits RGPD et transferts hors UE.",
};

const muted = { color: 'var(--text-muted)' };

const sections: { title: string; content: ReactNode }[] = [
  {
    title: 'Responsable du traitement',
    content: (
      <>
        <p style={{ margin: '0 0 12px' }}>
          Le responsable du traitement des données personnelles collectées via le service est{' '}
          <strong>Suimini</strong> (société à préciser).
        </p>
        <p style={{ margin: 0 }}>
          Pour toute question relative au traitement de vos données :{' '}
          <a href="mailto:contact@suimini.app" style={{ color: 'var(--accent)' }}>
            contact@suimini.app
          </a>
          .
        </p>
      </>
    ),
  },
  {
    title: 'Données collectées',
    content: (
      <>
        <p style={{ margin: '0 0 12px' }}>Suimini collecte les catégories de données suivantes :</p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li style={{ marginBottom: 6 }}>
            <strong>Données de compte</strong> — adresse email, prénom et nom.
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>Données d&apos;arbre</strong> — données généalogiques que vous saisissez
            (personnes, relations, dates, lieux).
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>Données tierces</strong> — photos que vous téléversez.
          </li>
          <li style={{ marginBottom: 0 }}>
            <strong>Logs techniques</strong> — adresse IP, type de navigateur.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Finalités du traitement',
    content: (
      <>
        <p style={{ margin: '0 0 12px' }}>Vos données sont traitées pour les finalités suivantes :</p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li style={{ marginBottom: 6 }}>Fourniture du service de généalogie.</li>
          <li style={{ marginBottom: 6 }}>Authentification et sécurisation de votre compte.</li>
          <li style={{ marginBottom: 6 }}>Envoi d&apos;emails (notamment les invitations).</li>
          <li style={{ marginBottom: 0 }}>Amélioration continue du service.</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Base légale',
    content: (
      <>
        <p style={{ margin: '0 0 12px' }}>
          Chaque traitement repose sur l&apos;une des bases légales prévues par le RGPD :
        </p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li style={{ marginBottom: 6 }}>
            <strong>Exécution du contrat</strong> (art. 6.1.b RGPD) — fourniture du service.
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>Consentement</strong> — téléversement de photos et fonctionnalités d&apos;IA.
          </li>
          <li style={{ marginBottom: 0 }}>
            <strong>Intérêt légitime</strong> — sécurité du service.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Destinataires des données',
    content: (
      <>
        <p style={{ margin: '0 0 12px' }}>
          Pour fournir le service, Suimini fait appel à des sous-traitants techniques :
        </p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li style={{ marginBottom: 6 }}>
            <strong>Supabase</strong> — hébergement de la base de données (UE/USA).
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>Anthropic</strong> — traitement par IA (données anonymisées).
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>Resend</strong> — envoi des emails.
          </li>
          <li style={{ marginBottom: 0 }}>
            <strong>Vercel</strong> — hébergement de l&apos;application.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Durée de conservation',
    content: (
      <>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li style={{ marginBottom: 6 }}>
            <strong>Compte actif</strong> — pendant toute la durée d&apos;utilisation du service.
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>Après suppression du compte</strong> — 30 jours.
          </li>
          <li style={{ marginBottom: 0 }}>
            <strong>Logs techniques</strong> — 90 jours.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Droits des personnes',
    content: (
      <>
        <p style={{ margin: '0 0 12px' }}>
          Conformément au RGPD, vous disposez des droits suivants sur vos données : droit
          d&apos;<strong>accès</strong>, de <strong>rectification</strong>, d&apos;
          <strong>effacement</strong>, de <strong>portabilité</strong> et d&apos;
          <strong>opposition</strong>.
        </p>
        <p style={{ margin: 0 }}>
          Pour exercer ces droits, contactez-nous à{' '}
          <a href="mailto:contact@suimini.app" style={{ color: 'var(--accent)' }}>
            contact@suimini.app
          </a>
          .
        </p>
      </>
    ),
  },
  {
    title: 'Transferts hors UE',
    content: (
      <>
        <p style={{ margin: '0 0 12px' }}>
          Certains sous-traitants sont situés en dehors de l&apos;Union européenne. Ces transferts
          sont encadrés par des garanties appropriées :
        </p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li style={{ marginBottom: 6 }}>
            <strong>Anthropic</strong> (USA) — clauses contractuelles types.
          </li>
          <li style={{ marginBottom: 0 }}>
            <strong>Vercel</strong> (USA) — cadre successeur du Privacy Shield.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Cookies',
    content: (
      <p style={{ margin: 0 }}>
        Suimini utilise uniquement des cookies <strong>nécessaires</strong> au fonctionnement du
        service, à savoir le cookie de session d&apos;authentification.{' '}
        <span style={muted}>
          Aucun cookie de tracking publicitaire n&apos;est utilisé.
        </span>
      </p>
    ),
  },
  {
    title: 'Contact DPO',
    content: (
      <p style={{ margin: 0 }}>
        Pour toute question relative à la protection de vos données personnelles, vous pouvez
        contacter notre délégué à la protection des données à l&apos;adresse{' '}
        <a href="mailto:contact@suimini.app" style={{ color: 'var(--accent)' }}>
          contact@suimini.app
        </a>
        .
      </p>
    ),
  },
];

export default function ConfidentialitePage() {
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
        Politique de confidentialité
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
