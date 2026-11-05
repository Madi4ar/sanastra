import { Card, Typography } from 'antd';
import type { UsageItem } from '@/api/types';
import { UsageBar } from '@/features/tenant/UsageBar';
import { formatNumber } from '@/shared/format';

/** Использование ресурсов организации: сколько потрачено и сколько осталось по лимитам тарифа. */
export function UsageSection({ usage }: { usage: UsageItem[] }) {
  return (
    <Card title="Использование ресурсов" data-testid="usage-section">
      <div className="grid grid-cols-3 gap-4">
        {usage.map((i) => (
          <div key={i.code} className="rounded-lg border border-border p-4" data-testid={`org-usage-${i.code}`}>
            <UsageBar item={i} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Использовано
                </Typography.Text>
                <div className="text-base font-semibold">
                  {formatNumber(i.used)} {i.unit}
                </div>
              </div>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Осталось
                </Typography.Text>
                <div className={`text-base font-semibold ${i.remaining === 0 ? 'text-error' : 'text-success'}`}>
                  {formatNumber(i.remaining)} {i.unit}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
