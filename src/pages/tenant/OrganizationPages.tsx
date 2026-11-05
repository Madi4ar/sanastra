import { Alert, Card, Descriptions, Empty, Skeleton, Table, Tag, Typography } from 'antd';
import { CalendarDays, Clock3, CreditCard, ShieldCheck } from 'lucide-react';
import type { UsageItem } from '@/api/types';
import { useTenantContext } from '@/features/tenant/access';
import { CardGrid, ModuleCard } from '@/features/tenant/ModuleCard';
import { StatCard, StatGrid } from '@/features/tenant/StatCard';
import { useSubscriptionSummary, useTenantUsage } from '@/features/tenant/queries';
import { UsageBar } from '@/features/tenant/UsageBar';
import { formatDate, formatDateTime, formatNumber } from '@/shared/format';
import { Highlight } from '@/shared/Highlight';
import { ErrorState } from '@/shared/PageState';
import { ExpiringAlert } from './DashboardPage';
import { PageHeader, Sections } from './PageHeader';

const STATUS_TEXT: Record<string, { color: string; label: string }> = {
  ACTIVE: { color: 'green', label: 'Активна' },
  BLOCKED: { color: 'red', label: 'Приостановлена' },
  EXPIRED: { color: 'red', label: 'Истекла' },
};

export function OrganizationInfoPage() {
  const { access } = useTenantContext();
  if (!access) return null;
  const status = STATUS_TEXT[access.subscriptionStatus]!;
  return (
    <>
      <PageHeader title="Общая информация" />
      <Card>
        <Descriptions
          column={{ xs: 1, md: 2 }}
          items={[
            { key: 'name', label: 'Название', children: access.organizationName },
            { key: 'url', label: 'Адрес кабинета', children: `${window.location.origin}/${access.clientSlug}/admin` },
            { key: 'status', label: 'Подписка', children: <Tag color={status.color}>{status.label}</Tag> },
            { key: 'tariff', label: 'Тариф', children: <Highlight value={access.tariff.name}>{access.tariff.name}</Highlight> },
          ]}
        />
      </Card>
    </>
  );
}

export function SubscriptionPage() {
  const { clientSlug } = useTenantContext();
  const summary = useSubscriptionSummary(clientSlug);

  return (
    <>
      <PageHeader title="Тариф и подписка" subtitle="Тариф, модули и лимиты настраивает администратор Sanastra." />
      {summary.isPending ? (
        <Card>
          <Skeleton active paragraph={{ rows: 5 }} />
        </Card>
      ) : summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <Sections>
          {summary.data.daysLeft <= summary.data.expiryWarningDays && (
            <ExpiringAlert daysLeft={summary.data.daysLeft} endDate={summary.data.subscriptionEndDate} />
          )}
          <StatGrid>
            <StatCard
              label="Статус"
              value={STATUS_TEXT[summary.data.status]?.label ?? '—'}
              tone={summary.data.status === 'ACTIVE' ? 'success' : 'danger'}
              icon={<ShieldCheck size={20} />}
            />
            <StatCard
              label="Тариф"
              value={<Highlight value={summary.data.tariff.name}>{summary.data.tariff.name}</Highlight>}
              icon={<CreditCard size={20} />}
            />
            <StatCard
              label="Осталось дней"
              value={<Highlight value={summary.data.daysLeft}>{summary.data.daysLeft}</Highlight>}
              tone={summary.data.daysLeft <= summary.data.expiryWarningDays ? 'warning' : 'info'}
              icon={<CalendarDays size={20} />}
            />
            <StatCard
              label="Действует до"
              value={<Highlight value={summary.data.subscriptionEndDate}>{formatDate(summary.data.subscriptionEndDate)}</Highlight>}
              tone="info"
              icon={<Clock3 size={20} />}
            />
          </StatGrid>
          <Card data-testid="tariff-card">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Typography.Title level={4} style={{ margin: 0 }}>
                <Highlight value={summary.data.tariff.name}>
                  <span data-testid="tariff-name">{summary.data.tariff.name}</span>
                </Highlight>
              </Typography.Title>
              <Tag color={STATUS_TEXT[summary.data.status]?.color}>{STATUS_TEXT[summary.data.status]?.label}</Tag>
            </div>
            <Typography.Paragraph type="secondary">{summary.data.tariff.description}</Typography.Paragraph>
            <Descriptions
              column={{ xs: 1, md: 2 }}
              items={[
                {
                  key: 'start',
                  label: 'Дата начала',
                  children: (
                    <Highlight value={summary.data.subscriptionStartDate}>
                      {formatDate(summary.data.subscriptionStartDate)}
                    </Highlight>
                  ),
                },
                {
                  key: 'end',
                  label: 'Дата окончания',
                  children: (
                    <Highlight value={summary.data.subscriptionEndDate}>
                      <span data-testid="end-date">{formatDate(summary.data.subscriptionEndDate)}</span>
                    </Highlight>
                  ),
                },
                {
                  key: 'left',
                  label: 'Осталось',
                  children: <Highlight value={summary.data.daysLeft}>{summary.data.daysLeft} дн.</Highlight>,
                },
                { key: 'updated', label: 'Обновлено', children: formatDateTime(summary.data.updatedAt) },
              ]}
            />
          </Card>
        </Sections>
      )}
    </>
  );
}

export function ModulesPage() {
  const { availableModules } = useTenantContext();
  return (
    <>
      <PageHeader title="Модули" subtitle="Возможности, доступные в текущей конфигурации организации." />
      {availableModules.length ? (
        <CardGrid testId="modules-grid">
          {availableModules.map((m, i) => (
            <ModuleCard key={m.code} module={m} showStatus index={i} />
          ))}
        </CardGrid>
      ) : (
        <Card>
          <Empty description="Нет доступных модулей" />
        </Card>
      )}
    </>
  );
}

export function UsagePage() {
  const { clientSlug } = useTenantContext();
  const usage = useTenantUsage(clientSlug);
  const exhausted = usage.data?.items.filter((i) => i.state === 'EXHAUSTED') ?? [];

  return (
    <>
      <PageHeader title="Лимиты и использование" />
      {usage.isError && !usage.data ? (
        <ErrorState error={usage.error} onRetry={() => void usage.refetch()} />
      ) : (
        <Sections>
          {exhausted.map((i) => (
            <Alert
              key={i.code}
              type={i.used > i.limit ? 'error' : 'warning'}
              showIcon
              data-testid={`limit-alert-${i.code}`}
              title={
                i.used > i.limit
                  ? `Лимит «${i.name}» уменьшен ниже текущего использования`
                  : `Лимит «${i.name}» исчерпан`
              }
              description="Существующие данные сохранены, но создание новых недоступно. Для увеличения лимита обратитесь к администратору Sanastra."
            />
          ))}
          <Card styles={{ body: { padding: 0 } }}>
            <Table<UsageItem>
              rowKey="code"
              loading={usage.isPending}
              dataSource={usage.data?.items ?? []}
              pagination={false}
              scroll={{ x: 720 }}
              columns={[
                { title: 'Лимит', dataIndex: 'name', ellipsis: { showTitle: true } },
                {
                  title: 'Использовано',
                  key: 'used',
                  width: 160,
                  render: (_, i) => (
                    <Highlight value={i.used}>
                      {formatNumber(i.used)} {i.unit}
                    </Highlight>
                  ),
                },
                {
                  title: 'Доступно',
                  key: 'limit',
                  width: 160,
                  render: (_, i) => (
                    <Highlight value={i.limit}>
                      <span data-testid={`usage-limit-${i.code}`}>
                        {formatNumber(i.limit)} {i.unit}
                      </span>
                    </Highlight>
                  ),
                },
                {
                  title: 'Осталось',
                  key: 'remaining',
                  width: 140,
                  render: (_, i) => `${formatNumber(i.remaining)} ${i.unit}`,
                },
                { title: 'Состояние', key: 'state', width: 220, render: (_, i) => <UsageBar item={i} compact /> },
              ]}
            />
          </Card>
        </Sections>
      )}
    </>
  );
}
