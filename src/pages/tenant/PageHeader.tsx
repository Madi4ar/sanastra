import type { ReactNode } from 'react';

/** Заголовок страницы кабинета (визуальный язык NIS Academy): H1 28/700, описание, действия справа. */
export function PageHeader({
  title,
  subtitle,
  extra,
  as: Tag = 'h1',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
  as?: 'h1' | 'h2';
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <Tag
          className={
            Tag === 'h1'
              ? 'm-0 text-2xl font-bold tracking-tight text-text sm:text-[28px]'
              : 'm-0 text-lg font-semibold text-text'
          }
        >
          {title}
        </Tag>
        {subtitle && <p className="mt-1 mb-0 text-sm text-muted sm:text-base">{subtitle}</p>}
      </div>
      {extra && <div className="flex flex-wrap gap-2">{extra}</div>}
    </div>
  );
}

/** Заголовок секции внутри страницы с необязательной ссылкой справа. */
export function SectionTitle({ title, extra }: { title: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="m-0 text-lg font-semibold text-text">{title}</h2>
      {extra}
    </div>
  );
}

/** Вертикальный стек секций с интервалом 24 px. */
export function Sections({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-6">{children}</div>;
}
