import { Card, Tag } from 'antd';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { TenantModule } from '@/api/types';
import { ModuleIcon } from '@/shared/ModuleIcon';
import { useCabinet } from './cabinet';
import { TONE_CLASS, type Tone } from './StatCard';

/** Мягкие подложки иконок чередуются по токенам — карточки различимы, но в одной системе. */
const ICON_TONES: Tone[] = ['primary', 'info', 'success', 'warning'];

/**
 * Карточка модуля одинаковой высоты: иконка, название, описание, одно действие.
 * Вся карточка кликабельна (кнопка), как карточки разделов NIS Academy.
 */
export function ModuleCard({
  module,
  showStatus,
  index = 0,
}: {
  module: TenantModule;
  showStatus?: boolean;
  index?: number;
}) {
  const navigate = useNavigate();
  const { base } = useCabinet();
  const tone = ICON_TONES[index % ICON_TONES.length]!;
  return (
    <Card
      className="h-full"
      styles={{ body: { height: '100%', padding: 0 } }}
      hoverable
      data-testid={`module-card-${module.code}`}
    >
      <button
        type="button"
        aria-label={`Открыть: ${module.name}`}
        onClick={() => navigate(`${base}/m/${module.code}`)}
        className="focus-ring group flex h-full w-full cursor-pointer flex-col gap-4 rounded-lg border-0 bg-transparent p-5 text-left"
      >
        <span className="flex w-full items-start justify-between gap-2">
          <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${TONE_CLASS[tone]}`}>
            <ModuleIcon name={module.icon} size={20} />
          </span>
          {showStatus && <Tag color="green">Доступен</Tag>}
        </span>
        <span className="block min-w-0 flex-1">
          <span className="block truncate font-semibold text-text" title={module.name}>
            {module.name}
          </span>
          <span className="mt-1 line-clamp-2 block text-sm text-muted" title={module.description}>
            {module.description}
          </span>
        </span>
        <span className="flex items-center gap-1 text-sm font-medium text-primary">
          Открыть
          <ArrowRight size={16} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>
    </Card>
  );
}

/** Сетка без пустых мест: auto-fill пересобирается при скрытии модуля. */
export function CardGrid({ children, testId, min = 240 }: { children: ReactNode; testId?: string; min?: number }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }}
      data-testid={testId}
    >
      {children}
    </div>
  );
}
