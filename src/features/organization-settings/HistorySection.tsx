import { Card, Table, Tag, Typography } from 'antd';
import type { SubscriptionHistoryEntry } from '@/api/types';
import { formatDate, formatDateTime, SOURCE_LABEL } from '@/shared/format';
import { formatDiscount, formatKzt, OPERATION_LABEL } from '@/shared/pricing';

/** Автоматический неизменяемый блок: каждая запись создаётся сервером при сохранении подписки или оплате. */
export function HistorySection({ history }: { history: SubscriptionHistoryEntry[] }) {
  return (
    <Card
      title="История тарифов и периодов подписки"
      extra={<Typography.Text type="secondary">Только чтение</Typography.Text>}
      styles={{ body: { padding: 0 } }}
      data-testid="subscription-history"
    >
      <Table<SubscriptionHistoryEntry>
        rowKey="id"
        size="middle"
        dataSource={history}
        pagination={history.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
        scroll={{ x: 1100 }}
        locale={{ emptyText: 'Записей пока нет' }}
        onRow={(h) => ({ 'data-testid': `history-row-${h.status}` }) as React.HTMLAttributes<HTMLElement>}
        columns={[
          {
            title: 'Дата операции',
            key: 'operationAt',
            width: 190,
            render: (_, h) => (
              <div>
                <div>{formatDateTime(h.operationAt)}</div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {OPERATION_LABEL[h.operation]} · {SOURCE_LABEL[h.source]}
                </Typography.Text>
              </div>
            ),
          },
          { title: 'Тариф', dataIndex: 'tariffName', key: 'tariff', width: 130 },
          {
            title: 'Период действия',
            key: 'period',
            width: 210,
            render: (_, h) => `${formatDate(h.periodStart)} – ${formatDate(h.periodEnd)}`,
          },
          {
            title: 'Базовая годовая цена',
            dataIndex: 'basePrice',
            key: 'basePrice',
            align: 'right',
            render: (v: number) => formatKzt(v),
          },
          {
            title: 'Ручная скидка',
            key: 'discount',
            align: 'right',
            render: (_, h) => formatDiscount(h.discount),
          },
          {
            title: 'Итоговая цена',
            dataIndex: 'finalPrice',
            key: 'finalPrice',
            align: 'right',
            render: (v: number) => <span className="font-semibold">{formatKzt(v)}</span>,
          },
          {
            title: 'Статус',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (v: SubscriptionHistoryEntry['status']) =>
              v === 'ACTIVE' ? <Tag color="green">Активен</Tag> : <Tag>Завершён</Tag>,
          },
        ]}
      />
    </Card>
  );
}
