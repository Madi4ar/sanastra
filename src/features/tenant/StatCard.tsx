import { Card } from 'antd';
import type { ReactNode } from 'react';

export type Tone = 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export const TONE_CLASS: Record<Tone, string> = {
  primary: 'bg-primary-soft text-primary',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-error-soft text-error',
  neutral: 'bg-subtle text-muted',
};

/** KPI-карточка (из визуального языка NIS Academy): подпись, крупное значение, подсказка, иконка на мягкой подложке. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'primary',
  testId,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  testId?: string;
}) {
  return (
    <Card className="h-full" styles={{ body: { padding: 16 } }} data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-xs font-medium tracking-wide break-words hyphens-auto text-muted uppercase">{label}</p>
          <p className="tabular m-0 mt-1 text-xl font-bold break-words text-text sm:text-2xl">{value}</p>
          {hint && <p className="m-0 mt-1 text-xs text-muted">{hint}</p>}
        </div>
        {icon && (
          <span className={`flex shrink-0 items-center justify-center rounded-md p-2 ${TONE_CLASS[tone]}`} aria-hidden>
            {icon}
          </span>
        )}
      </div>
    </Card>
  );
}

/** Ряд KPI: 2 колонки на мобильных, 4 на desktop. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}
