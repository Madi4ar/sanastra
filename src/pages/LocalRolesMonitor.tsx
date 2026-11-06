import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Alert, Card, Empty, Input, Modal, Skeleton, Table, Tag, Tree, Typography } from 'antd';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { AuditChange, AuditEntry, AuditEvent, LocalRoleRow, OrganizationStructure } from '@/api/types';
import { formatDate, formatDateTime } from '@/shared/format';
import { ErrorState } from '@/shared/PageState';
import { useDebouncedValue } from '@/shared/useDebouncedValue';

const EVENT_LABEL: Record<AuditEvent, string> = {
  ROLE_CREATED: 'Создание роли',
  ROLE_DELETED: 'Удаление роли',
  ROLE_MATRIX_CHANGED: 'Изменение матрицы привилегий',
  USER_BOUND_TO_DEPARTMENT: 'Привязка пользователя к отделу',
};

const EVENT_COLOR: Record<AuditEvent, string> = {
  ROLE_CREATED: 'green',
  ROLE_DELETED: 'red',
  ROLE_MATRIX_CHANGED: 'blue',
  USER_BOUND_TO_DEPARTMENT: 'purple',
};

type Member = OrganizationStructure['members'][number];

function MemberLine({ member }: { member: Member }) {
  return (
    <span className="flex flex-wrap items-center gap-2 py-0.5" data-testid="structure-member">
      <span className="text-text">{member.fullName}</span>
      <span className="text-xs text-muted">{member.email}</span>
      {member.roles.map((r) => (
        <Tag key={r} className="m-0">
          {r}
        </Tag>
      ))}
      {!member.active && <Tag className="m-0">Неактивен</Tag>}
    </span>
  );
}

function toTree(s: OrganizationStructure, parentId: string | null): NonNullable<React.ComponentProps<typeof Tree>['treeData']> {
  return s.departments
    .filter((d) => d.parentId === parentId)
    .map((d) => {
      const members = s.members.filter((m) => m.departmentId === d.id);
      return {
        key: d.id,
        selectable: false,
        title: (
          <span className="font-medium text-text">
            {d.name} <span className="text-xs font-normal text-muted">· сотрудников: {members.length}</span>
          </span>
        ),
        children: [
          ...members.map((m) => ({ key: m.id, selectable: false, isLeaf: true, title: <MemberLine member={m} /> })),
          ...toTree(s, d.id),
        ],
      };
    });
}

/** Полное дерево отделов компании и привязанные к ним пользователи */
function StructureModal({ row, onClose }: { row: LocalRoleRow; onClose: () => void }) {
  const q = useQuery({
    queryKey: queryKeys.organizationStructure(row.tenantId),
    queryFn: () => api.localRoles.structure(row.tenantId),
  });
  const unassigned = q.data?.members.filter((m) => !m.departmentId) ?? [];

  return (
    <Modal open width={760} title={`Структура компании: ${row.organizationName}`} footer={null} onCancel={onClose} destroyOnHidden>
      {q.isPending ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <div className="flex flex-col gap-4 pt-2" data-testid="structure-modal">
          {q.data.departments.length ? (
            <Tree defaultExpandAll selectable={false} treeData={toTree(q.data, null)} />
          ) : (
            <Empty description="Отделы не созданы" />
          )}
          {unassigned.length > 0 && (
            <div>
              <p className="m-0 mb-1 text-sm font-medium">Без отдела</p>
              {unassigned.map((m) => (
                <MemberLine key={m.id} member={m} />
              ))}
            </div>
          )}
          <div>
            <p className="m-0 mb-1 text-sm font-medium">Доступ локальных ролей</p>
            <p className="m-0 mb-2 text-xs text-muted">
              В рабочем режиме действуют опции тарифа и глобальной роли «Администратор организации»; остальные — в демо-режиме.
            </p>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
              {q.data.roles.map((r) => (
                <li key={r.id} data-testid="structure-role">
                  {r.name}: действует опций {r.optionsEffective} из {r.optionsTotal}
                  {r.optionsEffective < r.optionsTotal && (
                    <Tag color="warning" className="ml-2">
                      Ограничено: {r.optionsTotal - r.optionsEffective}
                    </Tag>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}

const showValue = (v: string | null) => v ?? '—';

function ChangeLine({ change }: { change: AuditChange }) {
  return (
    <div className="text-xs">
      <span className="font-medium">{change.field}: </span>
      <Typography.Text delete={Boolean(change.oldValue && change.newValue)} type="secondary" style={{ fontSize: 12 }}>
        {showValue(change.oldValue)}
      </Typography.Text>
      {' → '}
      <span className="break-all">{showValue(change.newValue)}</span>
    </div>
  );
}

function AuditTrail() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const q = useQuery({
    queryKey: queryKeys.localRolesAudit(page, pageSize),
    queryFn: () => api.localRoles.audit({ page, pageSize }),
    placeholderData: keepPreviousData,
  });

  return (
    <Card title="Лог действий (Audit Trail)" styles={{ body: { padding: 0 } }} data-testid="audit-trail">
      {q.isError ? (
        <div className="p-6">
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        </div>
      ) : (
        <Table<AuditEntry>
          rowKey="id"
          loading={q.isPending}
          dataSource={q.data?.items}
          scroll={{ x: 980 }}
          pagination={{
            current: page,
            pageSize,
            total: q.data?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            onChange: (p, s) => {
              setPage(s === pageSize ? p : 1);
              setPageSize(s);
            },
          }}
          columns={[
            { title: 'Дата и время', key: 'at', width: 160, render: (_, e) => formatDateTime(e.at) },
            {
              title: 'Организация и администратор',
              key: 'org',
              width: 250,
              render: (_, e) => (
                <div>
                  <div>{e.organizationName}</div>
                  <div className="mono text-xs text-muted">ID: {e.adminId}</div>
                </div>
              ),
            },
            {
              title: 'Тип события',
              key: 'event',
              width: 250,
              render: (_, e) => (
                <div>
                  <Tag color={EVENT_COLOR[e.event]}>{EVENT_LABEL[e.event]}</Tag>
                  <div className="mt-1 text-xs text-muted">{e.target}</div>
                </div>
              ),
            },
            {
              title: 'Детали изменения (было → стало)',
              key: 'changes',
              render: (_, e) => e.changes.map((c) => <ChangeLine key={c.field} change={c} />),
            },
          ]}
        />
      )}
    </Card>
  );
}

/**
 * «Пользовательские роли компаний»: роли и отделы, созданные администраторами организаций.
 * Только чтение: управляющих элементов здесь нет, компании ведут свою структуру самостоятельно.
 */
export function LocalRolesMonitor() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [opened, setOpened] = useState<LocalRoleRow | null>(null);
  const debounced = useDebouncedValue(search.trim(), 300);
  const q = useQuery({
    queryKey: queryKeys.localRoles(debounced, page, pageSize),
    queryFn: () => api.localRoles.list({ search: debounced, page, pageSize }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-4">
      <Alert
        type="info"
        showIcon
        title="Только просмотр"
        description="Роли и отделы создают и меняют администраторы компаний. Суперадминистратор видит их, но не может изменить."
      />
      <Card title="Пользовательские роли и отделы" styles={{ body: { padding: 0 } }} data-testid="local-roles">
        <div className="p-4">
          <Input
            allowClear
            prefix={<Search size={14} className="text-muted" aria-hidden />}
            placeholder="Поиск по организации, роли или отделу"
            aria-label="Поиск по пользовательским ролям"
            className="max-w-md"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {q.isError ? (
          <div className="p-6">
            <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          </div>
        ) : (
          <Table<LocalRoleRow>
            rowKey="id"
            loading={q.isPending}
            dataSource={q.data?.items}
            scroll={{ x: 820 }}
            locale={{ emptyText: debounced ? 'Ничего не найдено' : 'Компании ещё не создали собственные роли' }}
            pagination={{
              current: page,
              pageSize,
              total: q.data?.total ?? 0,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50],
              onChange: (p, s) => {
                setPage(s === pageSize ? p : 1);
                setPageSize(s);
              },
            }}
            onRow={(r) =>
              ({
                'data-testid': `local-role-${r.id}`,
                tabIndex: 0,
                'aria-label': `Открыть структуру компании ${r.organizationName}`,
                style: { cursor: 'pointer' },
                onClick: () => setOpened(r),
                onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setOpened(r);
                  }
                },
              }) as React.HTMLAttributes<HTMLElement>
            }
            columns={[
              {
                title: 'Организация',
                key: 'org',
                render: (_, r) => (
                  <Link to={`/superadmin/organizations/${r.tenantId}`} onClick={(e) => e.stopPropagation()}>
                    {r.organizationName}
                  </Link>
                ),
              },
              { title: 'Название роли', dataIndex: 'roleName', key: 'role' },
              {
                title: 'Привязанный отдел',
                key: 'department',
                render: (_, r) => r.departmentName ?? <span className="text-muted">—</span>,
              },
              { title: 'Количество сотрудников', dataIndex: 'employeesCount', key: 'employees', width: 150, align: 'right' },
              { title: 'Дата создания', key: 'createdAt', width: 140, render: (_, r) => formatDate(r.createdAt) },
            ]}
          />
        )}
      </Card>
      <AuditTrail />
      {opened && <StructureModal row={opened} onClose={() => setOpened(null)} />}
    </div>
  );
}
