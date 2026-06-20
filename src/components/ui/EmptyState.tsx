import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '64px 32px',
        gap: '12px',
      }}
    >
      <Icon size={48} aria-hidden="true" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
        {title}
      </h3>
      {description && (
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '320px', margin: 0 }}>
          {description}
        </p>
      )}
      {action && (
        <button type="button" className="btn btn-primary" onClick={action.onClick} style={{ marginTop: '4px' }}>
          {action.label}
        </button>
      )}
    </div>
  );
}
