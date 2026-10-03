// Shared form and status pieces. Server Components: no client JavaScript.

export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';

export const fieldClass = `bg-surface border-border-strong text-fg w-full rounded-sm border px-3 py-2 ${focusRing}`;

export const labelClass = 'mb-1 block text-sm font-medium';

const buttonBase = `duration-fast inline-flex items-center justify-center rounded-md px-4 py-2.5 font-semibold transition-colors ${focusRing}`;

export const buttonClass = {
  primary: `${buttonBase} bg-primary text-on-primary hover:bg-primary-hover`,
  secondary: `${buttonBase} border-border-strong text-fg hover:bg-surface-sunken border`,
  danger: `${buttonBase} bg-error text-on-error hover:opacity-90`,
};

type Tone = 'neutral' | 'warning' | 'error' | 'success';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-primary-soft text-primary-fg',
  warning: 'bg-accent-soft text-accent-fg',
  error: 'bg-error-soft text-error-fg',
  success: 'bg-success-soft text-success-fg',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`${toneClass[tone]} rounded-full px-2.5 py-0.5 text-xs font-medium`}>
      {children}
    </span>
  );
}

export function Notice({
  tone,
  role,
  children,
}: {
  tone: Tone;
  role?: 'alert' | 'status';
  children: React.ReactNode;
}) {
  return (
    <div role={role} className={`${toneClass[tone]} rounded-md px-4 py-3 text-sm`}>
      {children}
    </div>
  );
}

const statusLabels: Record<string, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  in_review: { label: 'In review', tone: 'neutral' },
  published: { label: 'Published', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'error' },
  retired: { label: 'Retired', tone: 'error' },
  approved: { label: 'Approved', tone: 'success' },
};

export function StatusBadge({ status }: { status: string }) {
  const known = statusLabels[status];
  return <Badge tone={known?.tone}>{known?.label ?? status}</Badge>;
}

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDate(date: Date): string {
  return dateFormat.format(date);
}
