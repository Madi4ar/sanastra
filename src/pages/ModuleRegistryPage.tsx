import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Input, Modal, Popover, Table, Tag, Typography } from 'antd';
import { ChevronsDownUp, ChevronsUpDown, History, Pencil, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { RegistryModule, RegistryOption, RegistryVersion } from '@/api/types';
import { Field } from '@/shared/FormField';
import { formatDateTime } from '@/shared/format';
import { IconButton } from '@/shared/IconButton';
import { ErrorState } from '@/shared/PageState';

interface RegistryRow {
  key: string;
  systemName: string;
  displayName: string | null;
  /** Только у модулей (корневых строк) */
  module?: RegistryModule;
  children?: RegistryRow[];
}

const PUBLISHED_BY: Record<RegistryVersion['publishedBy'], string> = {
  CI_CD: 'CI/CD',
  SYSTEM_API: 'Системный API',
};

const nameOf = (r: Pick<RegistryRow, 'displayName' | 'systemName'>) => r.displayName ?? r.systemName;

function toRow(o: RegistryOption): RegistryRow {
  return {
    key: o.key,
    systemName: o.systemName,
    displayName: o.displayName,
    ...(o.options?.length ? { children: o.options.map(toRow) } : {}),
  };
}

function countLeaves(rows: RegistryRow[] | undefined): number {
  return (rows ?? []).reduce((n, r) => n + (r.children ? countLeaves(r.children) : 1), 0);
}

function collectKeys(rows: RegistryRow[], into: string[] = []): string[] {
  for (const r of rows) {
    if (r.children) {
      into.push(r.key);
      collectKeys(r.children, into);
    }
  }
  return into;
}

/** Оставляет совпавшие строки и их предков; потомки совпавшей строки сохраняются целиком */
function filterRows(rows: RegistryRow[], q: string): RegistryRow[] {
  const out: RegistryRow[] = [];
  for (const r of rows) {
    const hit = [r.key, r.systemName, r.displayName ?? ''].some((v) => v.toLowerCase().includes(q));
    if (hit) out.push(r);
    else if (r.children) {
      const children = filterRows(r.children, q);
      if (children.length) out.push({ ...r, children });
    }
  }
  return out;
}

function VersionHistory({ module }: { module: RegistryModule }) {
  return (
    <div className="flex max-w-80 flex-col gap-2" data-testid={`versions-${module.key}`}>
      {module.versions.map((v, i) => (
        <div key={`${v.version}-${i}`} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <Tag color={i === 0 ? 'blue' : undefined} className="mono">
              v{v.version}
            </Tag>
            {i === 0 && <span className="text-xs text-muted">текущая</span>}
          </span>
          <span className="text-xs text-muted">
            {formatDateTime(v.publishedAt)} · {PUBLISHED_BY[v.publishedBy]}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Раздел «Модули»: реестр программных блоков, поставляемых разработкой.
 * Суперадминистратор только просматривает реестр и переименовывает отображаемые названия —
 * удаление и выключение элементов здесь отсутствуют.
 */
export function ModuleRegistryPage() {
  const registry = useQuery({ queryKey: queryKeys.moduleRegistry, queryFn: api.moduleRegistry.list });
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<readonly React.Key[]>([]);
  const [renaming, setRenaming] = useState<RegistryRow | null>(null);

  const rows = useMemo<RegistryRow[]>(
    () =>
      (registry.data ?? []).map((m) => ({
        key: m.key,
        systemName: m.systemName,
        displayName: m.displayName,
        module: m,
        children: m.options.map(toRow),
      })),
    [registry.data],
  );
  const q = search.trim().toLowerCase();
  const visible = useMemo(() => (q ? filterRows(rows, q) : rows), [rows, q]);
  const allKeys = useMemo(() => collectKeys(visible), [visible]);
  // При поиске дерево раскрыто полностью, чтобы найденные опции были видны
  const expandedKeys = q ? allKeys : expanded;
  const optionsTotal = useMemo(() => countLeaves(rows.flatMap((r) => r.children ?? [])), [rows]);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Модули
        </Typography.Title>
        <Typography.Text type="secondary">
          Реестр модулей и опций, поставляемых командой разработки. Модули публикуются и обновляются через CI/CD
          или системный API.
        </Typography.Text>
      </div>

      <Alert
        type="info"
        showIcon
        title="Реестр отражает технологический срез написанного кода"
        description="Доступны только просмотр и переименование отображаемых названий. Удаление и включение/выключение модулей в реестре отсутствуют — подключение модулей организациям настраивается в тарифах и карточке организации."
      />

      {registry.isError ? (
        <ErrorState error={registry.error} onRetry={() => void registry.refetch()} />
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <Input
              allowClear
              prefix={<Search size={14} className="text-muted" aria-hidden />}
              placeholder="Поиск по названию или ключу"
              aria-label="Поиск по реестру модулей"
              className="max-w-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex items-center gap-3">
              {registry.data && (
                <span className="text-sm text-muted" data-testid="registry-totals">
                  Модулей: {registry.data.length} · опций: {optionsTotal}
                </span>
              )}
              <Button
                icon={expandedKeys.length ? <ChevronsDownUp size={16} /> : <ChevronsUpDown size={16} />}
                disabled={Boolean(q)}
                onClick={() => setExpanded(expandedKeys.length ? [] : collectKeys(rows))}
              >
                {expandedKeys.length ? 'Свернуть все' : 'Развернуть все'}
              </Button>
            </div>
          </div>
          <Table<RegistryRow>
            rowKey="key"
            loading={registry.isPending}
            dataSource={visible}
            pagination={false}
            scroll={{ x: 960 }}
            expandable={{ expandedRowKeys: expandedKeys, onExpandedRowsChange: (keys) => setExpanded(keys), indentSize: 24 }}
            onRow={(r) => ({ 'data-testid': `registry-row-${r.key}` }) as React.HTMLAttributes<HTMLElement>}
            locale={{ emptyText: q ? 'Ничего не найдено' : 'Реестр пуст' }}
            columns={[
              {
                title: 'Название',
                key: 'name',
                render: (_, r) => (
                  <span className="inline-flex flex-col align-middle">
                    <span className={r.module ? 'font-semibold' : undefined}>{nameOf(r)}</span>
                    {r.displayName && r.displayName !== r.systemName && (
                      <span className="text-xs text-muted">Системное название: {r.systemName}</span>
                    )}
                  </span>
                ),
              },
              {
                title: 'Системный ключ',
                dataIndex: 'key',
                key: 'key',
                width: 300,
                render: (v: string) => <span className="mono text-xs">{v}</span>,
              },
              {
                title: 'Версия',
                key: 'version',
                width: 140,
                render: (_, r) =>
                  r.module ? (
                    <Popover title="История версий" content={<VersionHistory module={r.module} />} trigger="click">
                      <Button
                        size="small"
                        type="text"
                        icon={<History size={14} />}
                        aria-label={`Версия ${r.module.version}, история версий модуля «${nameOf(r)}»`}
                      >
                        <span className="mono">v{r.module.version}</span>
                      </Button>
                    </Popover>
                  ) : null,
              },
              {
                title: 'Опций',
                key: 'options',
                width: 90,
                render: (_, r) => (r.module ? <Tag>{countLeaves(r.children)}</Tag> : null),
              },
              {
                title: 'Обновлён',
                key: 'updatedAt',
                width: 170,
                render: (_, r) => (r.module ? <span className="text-sm">{formatDateTime(r.module.updatedAt)}</span> : null),
              },
              {
                title: '',
                key: 'actions',
                width: 64,
                align: 'center',
                render: (_, r) => (
                  <IconButton
                    type="text"
                    label={`Переименовать «${nameOf(r)}»`}
                    icon={<Pencil size={16} />}
                    onClick={() => setRenaming(r)}
                  />
                ),
              },
            ]}
          />
        </Card>
      )}

      {renaming && <RenameModal row={renaming} onClose={() => setRenaming(null)} />}
    </div>
  );
}

function RenameModal({ row, onClose }: { row: RegistryRow; onClose: () => void }) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [value, setValue] = useState(row.displayName ?? '');
  const [error, setError] = useState<string>();
  const trimmed = value.trim().replace(/\s+/g, ' ');
  const tooLong = trimmed.length > 120;

  const rename = useMutation({
    mutationFn: (displayName: string | null) => api.moduleRegistry.rename({ key: row.key, displayName }),
    onSuccess: (module) => {
      qc.setQueryData<RegistryModule[]>(queryKeys.moduleRegistry, (prev) =>
        prev?.map((m) => (m.key === module.key ? module : m)),
      );
      message.success('Название сохранено');
      onClose();
    },
    onError: (e) => {
      if (isApiError(e) && e.fieldErrors.displayName) setError(e.fieldErrors.displayName);
      else message.error(e.message);
    },
  });

  const next = trimmed || null;
  const unchanged = next === row.displayName;

  return (
    <Modal
      open
      title="Переименование"
      okText="Сохранить"
      cancelText="Отмена"
      width={560}
      confirmLoading={rename.isPending}
      okButtonProps={{ disabled: unchanged || tooLong }}
      onOk={() => rename.mutate(next)}
      onCancel={onClose}
      destroyOnHidden
      footer={(_, { OkBtn, CancelBtn }) => (
        <div className="flex items-center justify-between gap-2">
          <Button
            type="link"
            className="px-0"
            disabled={row.displayName === null || rename.isPending}
            onClick={() => rename.mutate(null)}
          >
            Вернуть системное название
          </Button>
          <span className="flex gap-2">
            <CancelBtn />
            <OkBtn />
          </span>
        </div>
      )}
    >
      <form
        className="flex flex-col gap-4 pt-2"
        noValidate
        aria-label="Переименование элемента реестра"
        onSubmit={(e) => {
          e.preventDefault();
          if (!unchanged && !tooLong) rename.mutate(next);
        }}
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Системный ключ</dt>
          <dd className="mono m-0">{row.key}</dd>
          <dt className="text-muted">Системное название</dt>
          <dd className="m-0">{row.systemName}</dd>
        </dl>
        <Field
          label="Коммерческое наименование"
          htmlFor="registry-display-name"
          error={tooLong ? 'Не более 120 символов' : error}
          hint="Отображается вместо системного названия. Оставьте пустым, чтобы показывать системное."
        >
          <Input
            id="registry-display-name"
            autoFocus
            placeholder={row.systemName}
            value={value}
            status={tooLong || error ? 'error' : undefined}
            onChange={(e) => {
              setValue(e.target.value);
              setError(undefined);
            }}
          />
        </Field>
      </form>
    </Modal>
  );
}
