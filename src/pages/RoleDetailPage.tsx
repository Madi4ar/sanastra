import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Descriptions, Input, Skeleton, Switch, Table, Tabs, Tag, Typography } from 'antd';
import { ChevronsDownUp, ChevronsUpDown, Pencil, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useBlocker, useParams, useSearchParams } from 'react-router';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { GlobalRole, RegistryModule, RegistryOption } from '@/api/types';
import { formatDateTime } from '@/shared/format';
import { ErrorState } from '@/shared/PageState';
import { leafKeys, modulesOf, TARIFF_MODULE_OF } from '@/shared/access';
import { RoleFormModal, RoleSystemHint, useGlobalRoles } from './RolesPage';

/** Модули тарифа — подписи для колонки «В составе тарифа» */
const TARIFF_MODULE_LABEL: Record<string, string> = {
  COURSES: 'Курсы',
  USERS: 'Пользователи',
  REPORTS: 'Отчёты',
  CHAT: 'Сообщения',
  CERTIFICATES: 'Сертификаты',
};

interface MatrixRow {
  key: string;
  name: string;
  /** Полные ключи листьев узла — то, что включает переключатель */
  leaves: string[];
  module?: RegistryModule;
  children?: MatrixRow[];
}

const nameOf = (n: { displayName: string | null; systemName: string }) => n.displayName ?? n.systemName;

function toRow(o: RegistryOption): MatrixRow {
  return {
    key: o.key,
    name: nameOf(o),
    leaves: o.options?.length ? leafKeys(o.options) : [o.key],
    ...(o.options?.length ? { children: o.options.map(toRow) } : {}),
  };
}

function collectParents(rows: MatrixRow[], into: string[] = []): string[] {
  for (const r of rows)
    if (r.children) {
      into.push(r.key);
      collectParents(r.children, into);
    }
  return into;
}

function filterRows(rows: MatrixRow[], q: string): MatrixRow[] {
  const out: MatrixRow[] = [];
  for (const r of rows) {
    if (r.name.toLowerCase().includes(q) || r.key.toLowerCase().includes(q)) out.push(r);
    else if (r.children) {
      const children = filterRows(r.children, q);
      if (children.length) out.push({ ...r, children });
    }
  }
  return out;
}

/**
 * «Матрица доступов» роли: модули и атомарные опции Реестра модулей в виде разворачиваемой
 * иерархической таблицы с переключателями ON / OFF. Изменения применяются по «Сохранить матрицу роли».
 */
function AccessMatrix({ role }: { role: GlobalRole }) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const registry = useQuery({ queryKey: queryKeys.moduleRegistry, queryFn: api.moduleRegistry.list });
  const [selected, setSelected] = useState(() => new Set(role.matrix));
  const [expanded, setExpanded] = useState<readonly React.Key[]>([]);
  const [search, setSearch] = useState('');

  const dirty = selected.size !== role.matrix.length || role.matrix.some((k) => !selected.has(k));
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);

  const rows = useMemo<MatrixRow[]>(
    () =>
      (registry.data ?? []).map((m) => ({
        key: m.key,
        name: nameOf(m),
        leaves: leafKeys(m.options),
        module: m,
        children: m.options.map(toRow),
      })),
    [registry.data],
  );
  const q = search.trim().toLowerCase();
  const visible = useMemo(() => (q ? filterRows(rows, q) : rows), [rows, q]);
  const expandedKeys = q ? collectParents(visible) : expanded;
  const totalLeaves = rows.reduce((n, r) => n + r.leaves.length, 0);

  const toggle = (leaves: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      leaves.forEach((k) => (on ? next.add(k) : next.delete(k)));
      return next;
    });

  const save = useMutation({
    mutationFn: () => api.roles.saveMatrix(role.id, [...selected]),
    onSuccess: (saved) => {
      qc.setQueryData<GlobalRole[]>(queryKeys.globalRoles, (prev) => prev?.map((r) => (r.id === saved.id ? saved : r)));
      void qc.invalidateQueries({ queryKey: ['role-access'] });
      message.success('Матрица роли сохранена. Права пользователей с этой ролью обновлены.');
    },
    onError: (e) => message.error(e.message),
  });

  if (registry.isPending) return <Skeleton active paragraph={{ rows: 6 }} />;
  if (registry.isError) return <ErrorState error={registry.error} onRetry={() => void registry.refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      {blocker.state === 'blocked' && (
        <Alert
          type="warning"
          showIcon
          title="Матрица роли не сохранена"
          action={
            <span className="flex gap-2">
              <Button size="small" onClick={() => blocker.reset()}>
                Остаться
              </Button>
              <Button size="small" danger onClick={() => blocker.proceed()}>
                Уйти без сохранения
              </Button>
            </span>
          }
        />
      )}
      <Alert
        type="info"
        showIcon
        title="Итоговый доступ = Матрица глобальной роли ∩ Состав модулей тарифа организации"
        description="Модули, которых нет в тарифе организации, пользователь не увидит, даже если они включены здесь: такие запросы блокируются (403)."
      />
      <Card styles={{ body: { padding: 0 } }}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <Input
            allowClear
            prefix={<Search size={14} className="text-muted" aria-hidden />}
            placeholder="Поиск модуля или опции"
            aria-label="Поиск по матрице доступов"
            className="max-w-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted" data-testid="matrix-totals">
              Включено опций: {selected.size} из {totalLeaves} · модулей: {modulesOf([...selected]).length}
            </span>
            <Button
              icon={expandedKeys.length ? <ChevronsDownUp size={16} /> : <ChevronsUpDown size={16} />}
              disabled={Boolean(q)}
              onClick={() => setExpanded(expandedKeys.length ? [] : collectParents(rows))}
            >
              {expandedKeys.length ? 'Свернуть все' : 'Развернуть все'}
            </Button>
          </div>
        </div>
        <Table<MatrixRow>
          rowKey="key"
          dataSource={visible}
          pagination={false}
          scroll={{ x: 760 }}
          expandable={{ expandedRowKeys: expandedKeys, onExpandedRowsChange: setExpanded, indentSize: 24 }}
          onRow={(r) => ({ 'data-testid': `matrix-row-${r.key}` }) as React.HTMLAttributes<HTMLElement>}
          columns={[
            {
              title: 'Модуль / опция',
              key: 'name',
              render: (_, r) => (
                <span className="inline-flex flex-col align-middle">
                  <span className={r.module ? 'font-semibold' : undefined}>{r.name}</span>
                  <span className="mono text-xs text-muted">{r.key}</span>
                </span>
              ),
            },
            {
              title: 'В составе тарифа',
              key: 'tariff',
              width: 180,
              render: (_, r) => {
                if (!r.module) return null;
                const t = TARIFF_MODULE_OF[r.key];
                return t === undefined ? (
                  <Tag>Не входит в тарифы</Tag>
                ) : t === null ? (
                  <Tag color="green">Базовый, любой тариф</Tag>
                ) : (
                  <Tag color="blue">Модуль «{TARIFF_MODULE_LABEL[t] ?? t}»</Tag>
                );
              },
            },
            {
              title: 'Доступ',
              key: 'switch',
              width: 170,
              render: (_, r) => {
                const on = r.leaves.filter((k) => selected.has(k)).length;
                const all = on === r.leaves.length && on > 0;
                return (
                  <span className="inline-flex items-center gap-2">
                    <Switch
                      checked={all}
                      checkedChildren="ON"
                      unCheckedChildren="OFF"
                      aria-label={`${r.name}: ${all ? 'включено' : 'выключено'}`}
                      onChange={(v) => toggle(r.leaves, v)}
                    />
                    {r.leaves.length > 1 && on > 0 && !all && (
                      <span className="text-xs text-muted">
                        {on} из {r.leaves.length}
                      </span>
                    )}
                  </span>
                );
              },
            },
          ]}
        />
      </Card>
      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-border bg-page py-3">
        {dirty && <span className="text-sm text-muted">Есть несохранённые изменения</span>}
        <Button disabled={!dirty || save.isPending} onClick={() => setSelected(new Set(role.matrix))}>
          Сбросить
        </Button>
        <Button type="primary" loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>
          Сохранить матрицу роли
        </Button>
      </div>
    </div>
  );
}

/** Глобальная роль: основные данные и «Матрица доступов» */
export function RoleDetailPage() {
  const { roleId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const roles = useGlobalRoles();
  const [editing, setEditing] = useState(false);
  const role = roles.data?.find((r) => r.id === roleId);
  const tab = params.get('tab') === 'matrix' ? 'matrix' : 'main';

  if (roles.isPending) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (roles.isError) return <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />;
  if (!role)
    return (
      <Card>
        <Typography.Paragraph>Роль не найдена.</Typography.Paragraph>
        <Link to="/superadmin/roles">К списку ролей</Link>
      </Card>
    );

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Typography.Title level={3} style={{ margin: 0 }}>
              {role.name}
            </Typography.Title>
            <RoleSystemHint role={role} />
          </div>
          <Typography.Text type="secondary" className="mono">
            {role.code}
          </Typography.Text>
        </div>
        <Button icon={<Pencil size={16} />} onClick={() => setEditing(true)}>
          Редактировать
        </Button>
      </div>

      <Tabs
        activeKey={tab}
        onChange={(k) => setParams(k === 'matrix' ? { tab: 'matrix' } : {}, { replace: true })}
        items={[
          {
            key: 'main',
            label: 'Основное',
            children: (
              <Card>
                <Descriptions
                  column={1}
                  items={[
                    { key: 'name', label: 'Название роли', children: role.name },
                    { key: 'code', label: 'Системный код / Slug', children: <span className="mono">{role.code}</span> },
                    { key: 'description', label: 'Описание', children: role.description || '—' },
                    { key: 'type', label: 'Тип', children: role.isSystem ? 'Системная (is_system = true)' : 'Кастомная' },
                    { key: 'users', label: 'Пользователей с ролью', children: role.usersCount },
                    {
                      key: 'matrix',
                      label: 'Матрица доступов',
                      children: `модулей: ${modulesOf(role.matrix).length}, опций: ${role.matrix.length}`,
                    },
                    { key: 'updated', label: 'Изменена', children: formatDateTime(role.updatedAt) },
                  ]}
                />
              </Card>
            ),
          },
          { key: 'matrix', label: 'Матрица доступов', children: <AccessMatrix key={role.id} role={role} /> },
        ]}
      />

      {editing && <RoleFormModal role={role} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
    </div>
  );
}
