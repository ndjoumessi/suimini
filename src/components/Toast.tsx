'use client';

interface Props {
  message: string;
  icon?: string;
}

export default function Toast({ message, icon = '✅' }: Props) {
  return (
    <div className="toast">
      <span>{icon}</span>
      <span>{message}</span>
    </div>
  );
}
