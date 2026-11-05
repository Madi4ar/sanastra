import { Alert, Button, Card, Empty, Input, Select, Skeleton, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Pencil, Plus, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { OrganizationListItem } from '@/api/types';
import { useOrganizationFilters, PAGE_SIZES } from '@/features/organizations/useOrganizationFilters';
import { useOrganizations, useTariffPlans } from '@/features/organizations/queries';
import { CreateOrganizationModal } from '@/features/organizations/CreateOrganizationModal';
import { CopyText } from '@/shared/CopyText';
import { formatDate, formatDateTime } from '@/shared/format';
import { IconButton } from '@/shared/IconButton';
import { ErrorState } from '@/shared/PageState';
import { StatusTag, STATUS_OPTIONS } from '@/shared/StatusTag';
import { useDebouncedValue } from '@/shared/useDebouncedValue';

export const SEARCH_DEBOUNCE_MS = 400;

export function OrganizationsPage() {
  const navigate = useNavigate();
  const { filters, update, reset, hasActiveFilters } = useOrganizationFilters();
  const tariffs = useTariffPlans();
  const query = useOrganizations(filters);
  const [createOpen, setCreateOpen] = useState(false);

  // Локальное значение поля поиска + debounce 400 мс перед записью в URL
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  useEffect(() => {
    if (debouncedSearch.trim() !== filters.search) update({ search: debouncedSearch.trim() }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);
  // Синхронизация поля при внешнем изменении URL (сброс, навигация назад)
  const [lastUrlSearch, setLastUrlSearch] = useState(filters.search);
  if (lastUrlSearch !== filters.search) {
    setLastUrlSearch(filters.search);
    if (filters.search !== searchInput.trim()) setSearchInput(filters.search);
  }

  const location = useLocation();
  const open = (row: OrganizationListItem) =>
    navigate(`/superadmin/organizations/${row.tenantId}`, { state: { from: location.search } });

  const columns: ColumnsType<OrganizationListItem> = [
    {
      title: 'Организация',
      dataIndex: 'name',
      width: 240,
      ellipsis: { showTitle: false },
      render: (name: string) => (
        <Typography.Text strong ellipsis={{ tooltip: name }} style={{ maxWidth: 220 }}>
          {name}
        </Typography.Text>
      ),
    },
    {
      title: 'Slug',
      dataIndex: 'clientSlug',
      width: 170,
      render: (slug: string) => <CopyText value={slug} label="slug" />,
    },
    {
      title: 'Тариф',
      dataIndex: ['tariffPlan', 'name'],
      width: 120,
      render: (_: unknown, row) => (row.tariffPlan ? <Tag>{row.tariffPlan.name}</Tag> : '—'),
    },
    { title: 'Статус', dataIndex: 'status', width: 140, render: (s: string) => <StatusTag status={s} /> },
    { title: 'Начало', dataIndex: 'subscriptionStartDate', width: 110, render: formatDate },
    { title: 'Окончание', dataIndex: 'subscriptionEndDate', width: 110, render: formatDate },
    {
      title: 'Модули',
      key: 'modules',
      width: 90,
      render: (_: unknown, row) => `${row.activeModulesCount} из ${row.modulesCount}`,
    },
    { title: 'Создана', dataIndex: 'createdAt', width: 160, render: formatDateTime },
    {
      title: 'Действия',
      key: 'actions',
      width: 104,
      fixed: 'right',
      align: 'center',
      render: (_: unknown, row) => (
        <IconButton
          type="text"
          label="Редактировать"
          icon={<Pencil size={16} />}
          onClick={(e) => {
            e.stopPropagation();
            open(row);
          }}
        />
      ),
    },
  ];

  const data = query.data;
  const firstLoad = query.isPending;
  const showFullError = query.isError && !data;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex items-center justify-between">
        <Typography.Title level={3} style={{ margin: 0 }}>
          Организации
        </Typography.Title>
        <Button type="primary" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
          Создать организацию
        </Button>
      </div>
      <CreateOrganizationModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Card styles={{ body: { padding: 16 } }}>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            allowClear
            aria-label="Поиск по названию или slug"
            placeholder="Поиск по названию или slug"
            prefix={<Search size={16} aria-hidden />}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: 320 }}
          />
          <Select
            aria-label="Статус"
            style={{ width: 200 }}
            value={filters.status}
            options={STATUS_OPTIONS}
            onChange={(status) => update({ status })}
          />
          <Select
            aria-label="Тарифный план"
            style={{ width: 200 }}
            value={filters.tariffPlanId}
            loading={tariffs.isPending}
            options={[
              { value: '', label: 'Все тарифы' },
              ...(tariffs.data ?? []).map((t) => ({ value: t.id, label: t.name })),
            ]}
            onChange={(tariffPlanId) => update({ tariffPlanId })}
          />
          <Button icon={<RotateCcw size={16} />} onClick={reset} disabled={!hasActiveFilters}>
            Сбросить фильтры
          </Button>
          <div className="ml-auto">
            <Tooltip title="Обновить данные">
              <Button
                aria-label="Обновить данные"
                icon={<RefreshCw size={16} className={query.isFetching && !firstLoad ? 'animate-spin' : undefined} />}
                onClick={() => void query.refetch()}
                disabled={query.isFetching}
              >
                Обновить
              </Button>
            </Tooltip>
          </div>
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        {firstLoad ? (
          <div className="p-6" data-testid="table-skeleton">
            <Skeleton active paragraph={{ rows: 8 }} />
          </div>
        ) : showFullError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <>
            {query.isError && (
              <Alert
                type="error"
                showIcon
                banner
                title="Не удалось обновить данные. Показаны ранее загруженные."
                action={
                  <Button size="small" onClick={() => void query.refetch()}>
                    Повторить
                  </Button>
                }
              />
            )}
            <Table<OrganizationListItem>
              rowKey="tenantId"
              columns={columns}
              dataSource={data?.items ?? []}
              loading={query.isFetching && query.isPlaceholderData}
              scroll={{ x: 1180 }}
              onRow={(row) => ({
                onClick: () => open(row),
                onKeyDown: (e) => {
                  if (e.key === 'Enter' && e.target === e.currentTarget) open(row);
                },
                tabIndex: 0,
                className: 'clickable-row',
                'aria-label': `Открыть карточку: ${row.name}`,
              })}
              locale={{
                emptyText: hasActiveFilters ? (
                  <Empty description="Ничего не найдено по заданным условиям">
                    <Button icon={<RotateCcw size={16} />} onClick={reset}>
                      Сбросить фильтры
                    </Button>
                  </Empty>
                ) : (
                  <Empty description="Организаций пока нет" />
                ),
              }}
              pagination={{
                current: data?.page ?? filters.page,
                pageSize: filters.pageSize,
                total: data?.total ?? 0,
                showSizeChanger: true,
                pageSizeOptions: PAGE_SIZES.map(String),
                showTotal: (total, [from, to]) => `${from}–${to} из ${total}`,
                onChange: (page, pageSize) =>
                  pageSize !== filters.pageSize ? update({ pageSize }) : update({ page }),
                style: { padding: '0 16px' },
              }}
            />
          </>
        )}
      </Card>
    </div>
  );
}
