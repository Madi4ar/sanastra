import { Progress, Typography } from 'antd';
import { tokens } from '@/app/theme';
import type { UsageItem, UsageState } from '@/api/types';
import { formatNumber } from '@/shared/format';
import { Highlight } from '@/shared/Highlight';

export const USAGE_STATE_LABEL: Record<UsageState, string> = {
  NORMAL: 'В пределах лимита',
  WARNING: 'Приближается к лимиту',
  CRITICAL: 'Почти исчерпан',
  EXHAUSTED: 'Лимит исчерпан',
};

const STROKE: Record<UsageState, string> = {
  NORMAL: tokens.colorPrimary,
  WARNING: tokens.colorWarning,
  CRITICAL: tokens.colorError,
  EXHAUSTED: tokens.colorError,
};

export const usagePercent = (i: Pick<UsageItem, 'used' | 'limit'>) =>
  i.limit > 0 ? Math.min(100, Math.round((i.used / i.limit) * 100)) : 100;

/** Использование лимита: прогресс + текст «82 из 150». Состояние приходит с сервера и дублируется текстом. */
export function UsageBar({ item, compact }: { item: UsageItem; compact?: boolean }) {
  return (
    <div data-testid={`usage-${item.code}`}>
      {!compact && (
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <Typography.Text strong ellipsis={{ tooltip: item.name }}>
            {item.name}
          </Typography.Text>
          <Typography.Text type="secondary" className="shrink-0">
            <Highlight value={[item.used, item.limit]}>
              {formatNumber(item.used)} из {formatNumber(item.limit)} {item.unit}
            </Highlight>
          </Typography.Text>
        </div>
      )}
      <Progress
        percent={usagePercent(item)}
        strokeColor={STROKE[item.state]}
        showInfo={false}
        aria-label={`${item.name}: использовано ${item.used} из ${item.limit}`}
      />
      <Typography.Text
        style={{ fontSize: 12, color: item.state === 'NORMAL' ? tokens.colorTextSecondary : STROKE[item.state] }}
      >
        {USAGE_STATE_LABEL[item.state]}
      </Typography.Text>
    </div>
  );
}
