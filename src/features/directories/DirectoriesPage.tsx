import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Empty, Input, Modal, Select, Table, Tag, Typography } from 'antd';
import { Lock, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { CatalogModule, DirectoryItem, DirectoryItemPayload, TenantDirectorySummary } from '@/api/types';
import { useCurrentUser } from '@/auth/auth';
import { UpgradePromoModal, useModuleCatalog } from '@/features/tenant-admin/UpgradePromo';
import { useCabinet } from '@/features/tenant/cabinet';
import { ADVANCED_DIRECTORIES_MODULE } from '@/shared/directories';
import { Field } from '@/shared/FormField';
import { IconButton } from '@/shared/IconButton';
import { ErrorState } from '@/shared/PageState';

interface DirectoryApi {
  keyPrefix: readonly unknown[];
  items: (code: string) => Promise<DirectoryItem[]>;
  create: (code: string, payload: DirectoryItemPayload) => Promise<DirectoryItem>;
  update: (code: string, id: string, payload: DirectoryItemPayload) => Promise<DirectoryItem>;
  remove: (code: string, id: string) => Promise<void>;
  /** Области для выбора у района */
  regions: () => Promise<{ value: string; label: string }[]>;
}

function ItemModal({
  source,
  code,
  title,
  item,
  onClose,
}: {
  source: DirectoryApi;
  code: string;
  title: string;
  item: DirectoryItem | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [values, setValues] = useState<DirectoryItemPayload>({
    nameKz: item?.nameKz ?? '',
    nameRu: item?.nameRu ?? '',
    parentId: item?.parentId ?? null,
  });
  const set = (patch: Partial<DirectoryItemPayload>) => setValues((v) => ({ ...v, ...patch }));
  const regions = useQuery({ queryKey: [...source.keyPrefix, 'regions'], queryFn: source.regions, enabled: code === 'district' });
  const save = useMutation({
    mutationFn: () => (item ? source.update(code, item.id, values) : source.create(code, values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: source.keyPrefix });
      message.success(item ? 'Запись сохранена' : 'Запись добавлена');
      onClose();
    },
  });
  const fe = isApiError(save.error) ? save.error.fieldErrors : {};
  const other = save.isError && !Object.keys(fe).length ? save.error.message : null;

  return (
    <Modal
      open
      title={title}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={save.isPending}
      onOk={() => save.mutate()}
      onCancel={onClose}
      destroyOnHidden
    >
      <form
        className="flex flex-col gap-4 pt-2"
        noValidate
        aria-label={title}
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {code === 'district' && (
          <Field label="Область" htmlFor="dir-parent" required error={fe.parentId}>
            <Select
              id="dir-parent"
              aria-label="Область"
              style={{ width: '100%' }}
              placeholder="Выберите область"
              showSearch={{ optionFilterProp: 'label' }}
              status={fe.parentId ? 'error' : undefined}
              value={values.parentId ?? undefined}
              options={regions.data ?? []}
              onChange={(parentId) => set({ parentId })}
            />
          </Field>
        )}
        <Field label="Название на казахском" htmlFor="dir-kz" required error={fe.nameKz}>
          <Input id="dir-kz" autoFocus maxLength={200} value={values.nameKz} status={fe.nameKz ? 'error' : undefined} onChange={(e) => set({ nameKz: e.target.value })} />
        </Field>
        <Field label="Название на русском" htmlFor="dir-ru" required error={fe.nameRu}>
          <Input id="dir-ru" maxLength={200} value={values.nameRu} status={fe.nameRu ? 'error' : undefined} onChange={(e) => set({ nameRu: e.target.value })} />
        </Field>
        {other && <Alert type="error" showIcon title={other} />}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function ItemsCard({
  source,
  directory,
  canCreate,
  canEdit,
  canDelete,
  createLabel,
  showScope,
}: {
  source: DirectoryApi;
  directory: { code: string; name: string };
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  createLabel: string;
  showScope: boolean;
}) {
  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const q = useQuery({ queryKey: [...source.keyPrefix, directory.code], queryFn: () => source.items(directory.code) });
  const [editing, setEditing] = useState<DirectoryItem | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const text = search.trim().toLowerCase();
  const visible = (q.data ?? [])
    .filter((i) => !text || [i.nameKz, i.nameRu].some((v) => v.toLowerCase().includes(text)))
    // Глобальные и локальные записи показываются раздельно
    .sort((a, b) => Number(a.scope === 'LOCAL') - Number(b.scope === 'LOCAL'));

  const remove = useMutation({
    mutationFn: (i: DirectoryItem) => source.remove(directory.code, i.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: source.keyPrefix });
      message.success('Запись удалена');
    },
    onError: (e) => message.error(e.message),
  });

  return (
    <Card
      title={directory.name}
      extra={
        canCreate && (
          <Button type="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
            {createLabel}
          </Button>
        )
      }
      styles={{ body: { padding: 0 } }}
      data-testid={`directory-${directory.code}`}
    >
      <div className="p-4">
        <Input
          allowClear
          className="max-w-sm"
          aria-label="Поиск по справочнику"
          placeholder="Поиск по названию"
          prefix={<Search size={14} className="text-muted" aria-hidden />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {q.isError ? (
        <div className="p-6">
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        </div>
      ) : (
        <Table<DirectoryItem>
          rowKey="id"
          loading={q.isPending}
          dataSource={visible}
          pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
          scroll={{ x: 720 }}
          locale={{ emptyText: text ? 'Ничего не найдено' : 'Записей пока нет' }}
          onRow={(i) => ({ 'data-testid': `directory-item-${i.scope}` }) as React.HTMLAttributes<HTMLElement>}
          columns={[
            { title: 'На русском', dataIndex: 'nameRu', key: 'ru' },
            { title: 'На казахском', dataIndex: 'nameKz', key: 'kz' },
            ...(directory.code === 'district'
              ? [{ title: 'Область', key: 'parent', render: (_: unknown, i: DirectoryItem) => i.parentName ?? '—' }]
              : []),
            ...(showScope
              ? [
                  {
                    title: 'Тип записи',
                    key: 'scope',
                    width: 220,
                    render: (_: unknown, i: DirectoryItem) =>
                      i.scope === 'GLOBAL' ? <Tag>Системный / Глобальный</Tag> : <Tag color="blue">Пользовательский / Организация</Tag>,
                  },
                ]
              : []),
            {
              title: '',
              key: 'actions',
              width: 96,
              render: (_: unknown, i: DirectoryItem) =>
                i.editable ? (
                  <span className="inline-flex gap-1">
                    {canEdit && <IconButton type="text" label={`Редактировать: ${i.nameRu}`} icon={<Pencil size={16} />} onClick={() => setEditing(i)} />}
                    {canDelete && (
                      <IconButton
                        type="text"
                        danger
                        label={`Удалить: ${i.nameRu}`}
                        icon={<Trash2 size={16} />}
                        onClick={() =>
                          modal.confirm({
                            title: `Удалить «${i.nameRu}»?`,
                            okText: 'Удалить',
                            cancelText: 'Отмена',
                            okButtonProps: { danger: true },
                            onOk: () => remove.mutate(i),
                          })
                        }
                      />
                    )}
                  </span>
                ) : (
                  <Lock size={14} className="text-muted" aria-label="Запись защищена от изменения" />
                ),
            },
          ]}
        />
      )}
      {editing && (
        <ItemModal
          source={source}
          code={directory.code}
          title={editing === 'new' ? `${createLabel}: ${directory.name}` : `Редактирование: ${directory.name}`}
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}

function DirectoryList<T extends { code: string; name: string; count: number }>({
  list,
  selected,
  onSelect,
  badge,
}: {
  list: T[];
  selected: string | undefined;
  onSelect: (d: T) => void;
  badge?: (d: T) => React.ReactNode;
}) {
  return (
    <Card styles={{ body: { padding: 8 } }} data-testid="directories-list">
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {list.map((d) => (
          <li key={d.code}>
            <button
              type="button"
              aria-current={d.code === selected}
              className={`flex w-full cursor-pointer flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-md border-0 px-3 py-2 text-left text-sm ${
                d.code === selected ? 'bg-primary-soft font-medium text-primary' : 'bg-transparent text-text hover:bg-subtle'
              }`}
              onClick={() => onSelect(d)}
            >
              <span className="min-w-0">{d.name}</span>
              {badge?.(d) ?? <span className="text-xs text-muted">{d.count}</span>}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const Heading = ({ subtitle }: { subtitle: string }) => (
  <div>
    <Typography.Title level={3} style={{ margin: 0 }}>
      Справочники
    </Typography.Title>
    <Typography.Text type="secondary">{subtitle}</Typography.Text>
  </div>
);

/** Суперадминистратор: глобальные записи всех 14 справочников */
export function SuperadminDirectoriesPage() {
  const list = useQuery({ queryKey: queryKeys.directories, queryFn: api.directories.list });
  const [code, setCode] = useState<string>();
  const current = list.data?.find((d) => d.code === code) ?? list.data?.[0];
  const source: DirectoryApi = {
    keyPrefix: queryKeys.directories,
    items: api.directories.items,
    create: api.directories.create,
    update: api.directories.update,
    remove: api.directories.remove,
    regions: async () => (await api.directories.items('region')).map((r) => ({ value: r.id, label: r.nameRu })),
  };
  return (
    <div className="flex flex-col gap-4 pb-6">
      <Heading subtitle="Глобальные значения для всех организаций. Компании дополняют их собственными записями, которые видят только они." />
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[300px_1fr]">
          <DirectoryList list={list.data ?? []} selected={current?.code} onSelect={(d) => setCode(d.code)} />
          {current && <ItemsCard key={current.code} source={source} directory={current} canCreate canEdit canDelete createLabel="Создать запись" showScope={false} />}
        </div>
      )}
    </div>
  );
}

/** Организация: глобальные записи и собственные локальные */
export function TenantDirectoriesPage() {
  const { clientSlug } = useCabinet();
  const { data: user } = useCurrentUser();
  const directories = api.tenantDirectories(clientSlug);
  const list = useQuery({ queryKey: queryKeys.tenantDirectories(clientSlug), queryFn: directories.list });
  const catalog = useModuleCatalog(clientSlug, true);
  const [code, setCode] = useState<string>();
  const [promo, setPromo] = useState<CatalogModule | null>(null);
  const work = (list.data ?? []).filter((d) => d.mode === 'WORK');
  const current = work.find((d) => d.code === code) ?? work[0];
  const source: DirectoryApi = {
    keyPrefix: queryKeys.tenantDirectories(clientSlug),
    items: directories.items,
    create: directories.create,
    update: directories.update,
    remove: directories.remove,
    regions: () => directories.options('region'),
  };
  const select = (d: TenantDirectorySummary) => {
    if (d.mode === 'WORK') {
      setCode(d.code);
      return;
    }
    const module = catalog.data?.find((m) => m.code === ADVANCED_DIRECTORIES_MODULE);
    if (module) setPromo(module);
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      <Heading
        subtitle={
          user?.role === 'ORGANIZATION_ADMIN'
            ? 'Значения платформы и записи вашей организации. Свои записи видите только вы.'
            : 'Значения платформы и записи вашей организации.'
        }
      />
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : !list.isPending && !list.data?.length ? (
        <Card>
          <Empty description="Для вашей роли справочники недоступны" />
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[300px_1fr]">
          <DirectoryList
            list={list.data ?? []}
            selected={current?.code}
            onSelect={select}
            badge={(d) =>
              d.mode === 'DEMO' ? (
                <Tag color="gold" className="m-0" data-testid={`directory-demo-${d.code}`}>
                  {d.upgradeTariff ? `Демо / Доступно в тарифе ${d.upgradeTariff.name}` : 'Демо'}
                </Tag>
              ) : undefined
            }
          />
          {current && (
            <ItemsCard
              key={current.code}
              source={source}
              directory={current}
              canCreate={current.canCreate}
              canEdit={current.canEdit}
              canDelete={current.canDelete}
              createLabel="Добавить свою запись"
              showScope
            />
          )}
        </div>
      )}
      {promo && <UpgradePromoModal module={promo} onClose={() => setPromo(null)} />}
    </div>
  );
}
