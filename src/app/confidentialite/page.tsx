import LegalDoc, { type SectionDef } from '@/components/LegalDoc';

export const metadata = {
  title: 'Politique de confidentialité | Suimini',
  description:
    "Politique de confidentialité de Suimini : données collectées, finalités, base légale, durées de conservation, droits RGPD et transferts hors UE.",
};

const SECTIONS: SectionDef[] = [
  { key: 'responsable', blocks: [{ p: 'p1' }, { p: 'p2' }] },
  { key: 'collectees', blocks: [{ p: 'intro' }, { ul: ['compte', 'arbre', 'tierces', 'logs'] }] },
  { key: 'finalites', blocks: [{ p: 'intro' }, { ul: ['i1', 'i2', 'i3', 'i4'] }] },
  { key: 'base', blocks: [{ p: 'intro' }, { ul: ['contrat', 'consentement', 'interet'] }] },
  { key: 'destinataires', blocks: [{ p: 'intro' }, { ul: ['supabase', 'anthropic', 'resend', 'vercel'] }] },
  { key: 'duree', blocks: [{ ul: ['actif', 'apres', 'logs'] }] },
  { key: 'droits', blocks: [{ p: 'p1' }, { p: 'p2' }] },
  { key: 'transferts', blocks: [{ p: 'intro' }, { ul: ['anthropic', 'vercel'] }] },
  { key: 'cookies', blocks: [{ p: 'p1' }] },
  { key: 'dpo', blocks: [{ p: 'p1' }] },
];

export default function ConfidentialitePage() {
  return <LegalDoc ns="privacy" sections={SECTIONS} />;
}
