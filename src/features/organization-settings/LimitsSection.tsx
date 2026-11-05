import { Card, Table, Tag, Typography } from 'antd';
import { Lock } from 'lucide-react';
import type { OrganizationLimit } from '@/api/types';
import { formatNumber } from '@/shared/format';
import type { TariffDefaults } from './model';

interface Props {
  limits: OrganizationLimit[];
  defaults: TariffDefaults;
  /** Значения изменятся после сохранения (смена тарифа или продление по актуальным условиям) */
  pending?: boolean;
}

/** Лимиты зафиксированы в тарифном плане: только чтение, изменение — переходом на другой тариф. */
export function LimitsSection({ limits, defaults, pending }: Props) {
  return (
    <Card
      title="Лимиты"
      extra={
        <span className="flex items-center gap-1 text-xs text-muted">
          <Lock size={12} aria-hidden /> Только чтение — определяются тарифом «{defaults.name}»
        </span>
      }
      styles={{ body: { padding: 0 } }}
      data-testid="limits-section"
    >
      <Table<OrganizationLimit>
        rowKey="code"
        pagination={false}
        dataSource={limits}
        columns={[
          {
            title: 'Лимит',
            key: 'limit',
            render: (_, l) => (
              <div className="flex items-center gap-2">
                <Typography.Text strong>{l.name}</Typography.Text>
                <Typography.Text type="secondary" className="mono" style={{ fontSize: 12 }}>
                  {l.code}
                </Typography.Text>
              </div>
            ),
          },
          {
            title: 'Значение по тарифу',
            key: 'value',
            width: 260,
            render: (_, l) => {
              const value = defaults.limits[l.code] ?? l.value;
              return (
                <span className="flex flex-wrap items-center gap-1" data-testid={`limit-effective-${l.code}`}>
                  <Tag color="green" variant="solid">
                    {formatNumber(value)} {l.unit}
                  </Tag>
                  {pending && value !== l.value && <Tag color="gold">было {formatNumber(l.value)}</Tag>}
                </span>
              );
            },
          },
        ]}
      />
    </Card>
  );
}
