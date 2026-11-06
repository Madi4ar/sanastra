import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Empty, Skeleton, Table, Tag, Typography } from 'antd';
import { CalendarDays, Clock3, CreditCard, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { BillingInfo, CatalogModule, SubscriptionHistoryEntry, UsageItem } from '@/api/types';
import { PaymentModal } from '@/features/tenant-admin/PaymentModal';
import { DemoBadge, UpgradePromoModal, useModuleCatalog } from '@/features/tenant-admin/UpgradePromo';
import { ModuleIcon } from '@/shared/ModuleIcon';
import { formatDiscount, formatKzt, OPERATION_LABEL } from '@/shared/pricing';
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

/** Блок «История подписок»: прошлые и текущие платёжные периоды */
function SubscriptionHistory({ history }: { history: SubscriptionHistoryEntry[] }) {
  return (
    <Card title="История подписок" styles={{ body: { padding: 0 } }} data-testid="billing-history">
      <Table<SubscriptionHistoryEntry>
        rowKey="id"
        dataSource={history}
        pagination={false}
        scroll={{ x: 860 }}
        columns={[
          { title: 'Дата операции', key: 'at', width: 160, render: (_, h) => formatDateTime(h.operationAt) },
          { title: 'Операция', key: 'operation', render: (_, h) => OPERATION_LABEL[h.operation] },
          { title: 'Тариф', dataIndex: 'tariffName', key: 'tariff' },
          { title: 'Период', key: 'period', render: (_, h) => `${formatDate(h.periodStart)} – ${formatDate(h.periodEnd)}` },
          { title: 'Годовая цена', key: 'final', align: 'right', render: (_, h) => formatKzt(h.finalPrice) },
          {
            title: 'Оплачено',
            key: 'paid',
            align: 'right',
            render: (_, h) =>
              h.payment ? `${formatKzt(h.payment.amount)} (${h.payment.period === 'YEAR' ? 'за год' : 'за месяц'})` : '—',
          },
          {
            title: 'Статус',
            key: 'status',
            width: 110,
            render: (_, h) => (h.status === 'ACTIVE' ? <Tag color="green">Активен</Tag> : <Tag>Завершён</Tag>),
          },
        ]}
      />
    </Card>
  );
}

function PriceDetails({ billing }: { billing: BillingInfo }) {
  return (
    <Descriptions
      className="mt-4"
      column={{ xs: 1, md: 3 }}
      items={[
        { key: 'base', label: 'Базовая годовая цена', children: formatKzt(billing.basePrice) },
        { key: 'discount', label: 'Индивидуальная скидка', children: formatDiscount(billing.discount) },
        { key: 'final', label: 'Итоговая годовая цена', children: <span className="font-semibold">{formatKzt(billing.finalPrice)}</span> },
      ]}
    />
  );
}

export function SubscriptionPage() {
  const { clientSlug, isAdmin } = useTenantContext();
  const summary = useSubscriptionSummary(clientSlug);
  const billing = useQuery({
    queryKey: queryKeys.tenantBilling(clientSlug),
    queryFn: () => api.tenantAdmin(clientSlug).billing(),
    enabled: isAdmin,
  });
  const [params, setParams] = useSearchParams();
  const upgrade = params.get('upgrade') ?? undefined;
  const [paying, setPaying] = useState(false);
  const closePayment = () => {
    setPaying(false);
    if (upgrade) setParams({}, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Тарифные планы и оплата"
        subtitle="Текущий тариф, история подписок, продление и переход на другой тариф."
        extra={
          isAdmin && (
            <Button type="primary" icon={<CreditCard size={16} />} onClick={() => setPaying(true)}>
              Оплатить / Продлить
            </Button>
          )
        }
      />
      {isAdmin && (paying || upgrade) && <PaymentModal clientSlug={clientSlug} initialTariffId={upgrade} onClose={closePayment} />}
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
            {billing.data && <PriceDetails billing={billing.data} />}
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
          {billing.data && <SubscriptionHistory history={billing.data.history} />}
        </Sections>
      )}
    </>
  );
}

export function ModulesPage() {
  const { availableModules, clientSlug, isAdmin } = useTenantContext();
  const catalog = useModuleCatalog(clientSlug, isAdmin);
  const [promo, setPromo] = useState<CatalogModule | null>(null);
  const locked = (catalog.data ?? []).filter((m) => !m.enabled);
  return (
    <>
      <PageHeader title="Модули" subtitle="Модули вашего тарифа и модули, доступные при переходе на другой тариф." />
      {promo && <UpgradePromoModal module={promo} onClose={() => setPromo(null)} />}
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
      {locked.length > 0 && (
        <div className="mt-6">
          <h2 className="m-0 mb-3 text-lg font-semibold text-text">Доступно в других тарифах</h2>
          <CardGrid testId="demo-modules-grid">
            {locked.map((m) => (
              <Card key={m.code} hoverable className="h-full" onClick={() => setPromo(m)} data-testid={`demo-module-${m.code}`}>
                <div className="flex flex-col items-start gap-2">
                  <ModuleIcon name={m.icon} />
                  <span className="font-semibold">{m.name}</span>
                  <span className="text-sm text-muted">{m.description}</span>
                  <DemoBadge module={m} />
                </div>
              </Card>
            ))}
          </CardGrid>
        </div>
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
