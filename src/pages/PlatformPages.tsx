import { useQuery } from '@tanstack/react-query';
import { Button, Card, Input, Progress, Table, Tag, Typography } from 'antd';
import { Search, UserPlus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { tokens } from '@/app/theme';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { OrganizationLimitsRow, PlatformUser, UsageState } from '@/api/types';
import { ROLE_LABEL } from '@/features/auth/roles';
import { usagePercent } from '@/features/tenant/UsageBar';
import { AssignRoleModal } from '@/features/users/OrganizationUsers';
import { formatNumber } from '@/shared/format';
import { ErrorState } from '@/shared/PageState';
import { StatusTag } from '@/shared/StatusTag';
import { useDebouncedValue } from '@/shared/useDebouncedValue';

function PageLayout({ title, extra, search, onSearch, placeholder, children }: {
  title: string;
  extra?: ReactNode;
  search: string;
  onSearch: (v: string) => void;
  placeholder: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex items-center justify-between">
        <Typography.Title level={3} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {extra}
      </div>
      <Card styles={{ body: { padding: 16 } }}>
        <Input
          allowClear
          aria-label={placeholder}
          placeholder={placeholder}
          prefix={<Search size={16} aria-hidden />}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          style={{ width: 360 }}
        />
      </Card>
      {children}
    </div>
  );
}

const STROKE: Record<UsageState, string> = {
  NORMAL: tokens.colorPrimary,
  WARNING: tokens.colorWarning,
  CRITICAL: tokens.colorError,
  EXHAUSTED: tokens.colorError,
};

/** Лимиты всех организаций: использование и итоговые значения. Изменение — в карточке организации. */
export function LimitsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim(), 300);
  const q = useQuery({ queryKey: queryKeys.platformLimits(debounced), queryFn: () => api.platform.limits(debounced) });
  const codes = q.data?.[0]?.items ?? [];

  return (
    <PageLayout title="Лимиты" search={search} onSearch={setSearch} placeholder="Поиск по названию или slug">
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          <Table<OrganizationLimitsRow>
            rowKey="tenantId"
            loading={q.isPending}
            dataSource={q.data}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            scroll={{ x: 1000 }}
            rowClassName={() => 'clickable-row'}
            onRow={(r) => ({ onClick: () => navigate(`/superadmin/organizations/${r.tenantId}`), style: { cursor: 'pointer' } })}
            columns={[
              {
                title: 'Организация',
                key: 'org',
                render: (_, r) => (
                  <div className="min-w-0">
                    <div className="font-semibold">{r.name}</div>
                    <div className="mono text-xs text-muted">{r.clientSlug}</div>
                  </div>
                ),
              },
              { title: 'Тариф', dataIndex: 'tariffName', key: 'tariff', width: 120, render: (v: string) => <Tag>{v}</Tag> },
              { title: 'Статус', dataIndex: 'status', key: 'status', width: 140, render: (v: string) => <StatusTag status={v} /> },
              ...codes.map((c, idx) => ({
                title: c.name,
                key: c.code,
                width: 200,
                render: (_: unknown, r: OrganizationLimitsRow) => {
                  const i = r.items[idx]!;
                  return (
                    <div data-testid={`limit-${r.clientSlug}-${i.code}`}>
                      <div className="flex items-center gap-1 text-sm">
                        {formatNumber(i.used)} из {formatNumber(i.limit)} {i.unit}
                        {i.overridden && <Tag color="blue" style={{ marginInlineStart: 4 }}>Индивидуально</Tag>}
                      </div>
                      <Progress percent={usagePercent(i)} showInfo={false} size="small" strokeColor={STROKE[i.state]} />
                    </div>
                  );
                },
              })),
            ]}
          />
        </Card>
      )}
    </PageLayout>
  );
}

/** Все пользователи платформы и их роли; назначение ролей Администратор / Тренер в организации. */
export function UsersPage() {
  const [search, setSearch] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const debounced = useDebouncedValue(search.trim(), 300);
  const q = useQuery({ queryKey: queryKeys.platformUsers(debounced), queryFn: () => api.platform.users(debounced) });

  return (
    <PageLayout
      title="Пользователи"
      search={search}
      onSearch={setSearch}
      placeholder="Поиск по ФИО, ИИН или email"
      extra={
        <Button type="primary" icon={<UserPlus size={16} />} onClick={() => setAssignOpen(true)}>
          Назначить роль
        </Button>
      }
    >
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          <Table<PlatformUser>
            rowKey="id"
            loading={q.isPending}
            dataSource={q.data}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            scroll={{ x: 900 }}
            columns={[
              { title: 'ФИО', dataIndex: 'fullName', key: 'fullName' },
              { title: 'ИИН', dataIndex: 'iin', key: 'iin', width: 150, render: (v: string) => <span className="mono">{v}</span> },
              { title: 'Email', dataIndex: 'email', key: 'email' },
              {
                title: 'Роли',
                key: 'roles',
                render: (_, u) => (
                  <span className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <Tag
                        key={`${r.role}:${r.clientSlug ?? ''}`}
                        color={r.role === 'SUPERADMIN' ? 'red' : r.role === 'ORGANIZATION_ADMIN' ? 'blue' : r.role === 'TRAINER' ? 'purple' : 'default'}
                      >
                        {ROLE_LABEL[r.role]}
                        {r.organizationName ? ` · ${r.organizationName}` : ''}
                      </Tag>
                    ))}
                  </span>
                ),
              },
            ]}
          />
        </Card>
      )}
      <AssignRoleModal open={assignOpen} onClose={() => setAssignOpen(false)} />
    </PageLayout>
  );
}
