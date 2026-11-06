import { useQuery } from '@tanstack/react-query';
import { Card, Table, Tag, Tooltip } from 'antd';
import { Link } from 'react-router';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { RoleEffectiveAccess } from '@/api/types';
import { ErrorState } from '@/shared/PageState';

/**
 * Итоговый доступ ролей в организации: Матрица глобальной роли ∩ Состав модулей тарифа.
 * Модули матрицы вне тарифа скрыты от пользователей и блокируются на уровне API (403).
 */
export function RoleAccessSection({ tenantId, version }: { tenantId: string; version: number }) {
  const access = useQuery({
    queryKey: [...queryKeys.roleAccess(tenantId), version],
    queryFn: () => api.roles.effectiveIn(tenantId),
  });
  const registry = useQuery({ queryKey: queryKeys.moduleRegistry, queryFn: api.moduleRegistry.list });
  const names = new Map((registry.data ?? []).map((m) => [m.key, m.displayName ?? m.systemName]));
  const label = (key: string) => names.get(key) ?? key;

  return (
    <Card
      title="Итоговый доступ ролей"
      extra={<span className="text-xs text-muted">Матрица роли ∩ модули тарифа</span>}
      styles={{ body: { padding: 0 } }}
      data-testid="role-access-section"
    >
      {access.isError ? (
        <div className="p-6">
          <ErrorState error={access.error} onRetry={() => void access.refetch()} />
        </div>
      ) : (
        <Table<RoleEffectiveAccess>
          rowKey="roleId"
          loading={access.isPending}
          dataSource={access.data}
          pagination={false}
          scroll={{ x: 760 }}
          onRow={(r) => ({ 'data-testid': `role-access-${r.roleId}` }) as React.HTMLAttributes<HTMLElement>}
          columns={[
            {
              title: 'Роль',
              key: 'role',
              width: 220,
              render: (_, r) => <Link to={`/superadmin/roles/${r.roleId}?tab=matrix`}>{r.roleName}</Link>,
            },
            {
              title: 'Модулей в матрице',
              key: 'matrix',
              width: 140,
              render: (_, r) => r.matrixModules.length,
            },
            {
              title: 'Доступно по тарифу',
              key: 'available',
              render: (_, r) => (
                <span className="flex flex-wrap gap-1">
                  <Tag color="green" className="font-semibold">
                    {r.availableModules.length}
                  </Tag>
                  {r.availableModules.map((m) => (
                    <Tag key={m}>{label(m)}</Tag>
                  ))}
                </span>
              ),
            },
            {
              title: 'Скрыто (нет в тарифе)',
              key: 'blocked',
              render: (_, r) =>
                r.blockedModules.length ? (
                  <span className="flex flex-wrap gap-1">
                    {r.blockedModules.map((m) => (
                      <Tooltip key={m} title="Модуль не входит в тариф организации — доступ блокируется (403)">
                        <Tag color="error">{label(m)}</Tag>
                      </Tooltip>
                    ))}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                ),
            },
          ]}
        />
      )}
    </Card>
  );
}
