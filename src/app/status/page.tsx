import StatusClient from './StatusClient';

export const metadata = {
  title: 'État des services | Suimini',
  description:
    "État en temps réel des services Supabase (base de données, authentification, stockage, temps réel, edge functions) dont dépend Suimini, et historique des incidents.",
};

// Public page — /status is not under /app, so the auth proxy does not guard it.
export default function StatusPage() {
  return <StatusClient />;
}
