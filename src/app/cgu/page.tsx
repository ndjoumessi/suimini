import LegalDoc, { type SectionDef } from '@/components/LegalDoc';

export const metadata = {
  title: "Conditions générales d'utilisation | Suimini",
  description:
    "Conditions générales d'utilisation de Suimini : accès au service, compte, données généalogiques, propriété intellectuelle, abonnements, résiliation et droit applicable.",
};

const SECTIONS: SectionDef[] = [
  { key: 'objet', blocks: [{ p: 'p1' }] },
  { key: 'acces', blocks: [{ p: 'p1' }, { p: 'p2' }] },
  { key: 'compte', blocks: [{ p: 'p1' }, { p: 'p2' }] },
  { key: 'donnees', blocks: [{ p: 'p1', icon: true }, { p: 'p2' }, { p: 'p3' }] },
  { key: 'pi', blocks: [{ p: 'p1' }, { p: 'p2' }, { p: 'p3' }] },
  { key: 'abos', blocks: [{ ul: ['free', 'famille', 'pro'] }] },
  { key: 'resiliation', blocks: [{ p: 'p1' }, { p: 'p2' }, { p: 'p3' }] },
  { key: 'responsabilite', blocks: [{ p: 'p1' }] },
  { key: 'droit', blocks: [{ p: 'p1' }] },
  { key: 'contact', blocks: [{ p: 'p1' }] },
];

export default function CguPage() {
  return <LegalDoc ns="cgu" sections={SECTIONS} />;
}
