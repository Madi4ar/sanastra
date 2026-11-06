import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Input, Modal, Radio, Select, Switch, Table, Tag } from 'antd';
import { Eye, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { RegistryModule, RegistryOption, TenantRole, TenantRolePayload } from '@/api/types';
import { useCurrentUser } from '@/auth/auth';
import { memberOptions, useMembers } from '@/features/tenant-admin/MembersSection';
import { useCabinet } from '@/features/tenant/cabinet';
import { leafKeys, modulesOf } from '@/shared/access';
import { Field } from '@/shared/FormField';
import { IconButton } from '@/shared/IconButton';
import { ErrorState } from '@/shared/PageState';
import { PageHeader } from './PageHeader';

interface MatrixRow {
  key: string;
  name: string;
  leaves: string[];
  children?: MatrixRow[];
}

const nameOf = (n: { displayName: string | null; systemName: string }) => n.displayName ?? n.systemName;

function optionRow(o: RegistryOption): MatrixRow {
  const children = o.options?.map(optionRow);
  return { key: o.key, name: nameOf(o), leaves: o.options?.length ? leafKeys(o.options) : [o.key], ...(children?.length ? { children } : {}) };
}

/** Матрица доступов: только модули и опции, разрешённые текущим тарифом */
function OptionMatrix({
  catalog,
  selected,
  onChange,
}: {
  catalog: RegistryModule[];
  selected: string[];
  /** Без обработчика — только просмотр */
  onChange?: (next: string[]) => void;
}) {
  const rows = useMemo<MatrixRow[]>(
    () => catalog.map((m) => ({ key: m.key, name: nameOf(m), leaves: leafKeys(m.options), children: m.options.map(optionRow) })),
    [catalog],
  );
  const toggle = (leaves: string[], on: boolean) => {
    const next = new Set(selected);
    leaves.forEach((k) => (on ? next.add(k) : next.delete(k)));
    onChange?.([...next]);
  };
  return (
    <Table<MatrixRow>
      rowKey="key"
      size="small"
      dataSource={rows}
      pagination={false}
      scroll={{ y: 360 }}
      data-testid="role-matrix"
      expandable={{ indentSize: 20 }}
      columns={[
        { title: 'Модуль / опция', dataIndex: 'name', key: 'name' },
        {
          title: 'Доступ',
          key: 'switch',
          width: 150,
          render: (_, r) => {
            const on = r.leaves.filter((k) => selected.includes(k)).length;
            const all = on === r.leaves.length;
            return (
              <span className="inline-flex items-center gap-2">
                <Switch
                  size="small"
                  checked={all}
                  disabled={!onChange}
                  checkedChildren="ON"
                  unCheckedChildren="OFF"
                  aria-label={`${r.name}: ${all ? 'включено' : 'выключено'}`}
                  onChange={(v) => toggle(r.leaves, v)}
                />
                {on > 0 && !all && (
                  <span className="text-xs text-muted">
                    {on}/{r.leaves.length}
                  </span>
                )}
              </span>
            );
          },
        },
      ]}
    />
  );
}

function RoleModal({
  clientSlug,
  role,
  catalog,
  onClose,
}: {
  clientSlug: string;
  role: TenantRole | null;
  catalog: RegistryModule[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const admin = api.tenantAdmin(clientSlug);
  const departments = useQuery({ queryKey: queryKeys.tenantAdmin(clientSlug, 'departments'), queryFn: admin.departments });
  const members = useMembers(clientSlug);
  const [values, setValues] = useState<TenantRolePayload>({
    nameKz: role?.nameKz ?? '',
    nameRu: role?.nameRu ?? '',
    description: role?.description ?? '',
    scope: role?.scope ?? 'MEMBERS',
    departmentId: role?.departmentId ?? null,
    memberIds: role?.memberIds ?? [],
    matrix: role?.matrix ?? [],
  });
  const set = (patch: Partial<TenantRolePayload>) => setValues((v) => ({ ...v, ...patch }));
  const save = useMutation({
    mutationFn: () => (role ? admin.updateRole(role.id, values) : admin.createRole(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tenant-admin', clientSlug] });
      message.success(role ? 'Роль сохранена' : 'Роль создана');
      onClose();
    },
  });
  const fe = isApiError(save.error) ? save.error.fieldErrors : {};
  const other = save.isError && !Object.keys(fe).length ? save.error.message : null;

  return (
    <Modal
      open
      width={820}
      title={role ? `Редактирование роли: ${role.nameRu}` : 'Новая роль'}
      okText={role ? 'Сохранить' : 'Создать роль'}
      cancelText="Отмена"
      confirmLoading={save.isPending}
      onOk={() => save.mutate()}
      onCancel={onClose}
      destroyOnHidden
    >
      <div className="flex flex-col gap-4 pt-2" data-testid="role-form">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Название роли на казахском" htmlFor="role-kz" required error={fe.nameKz}>
            <Input id="role-kz" maxLength={60} value={values.nameKz} status={fe.nameKz ? 'error' : undefined} onChange={(e) => set({ nameKz: e.target.value })} />
          </Field>
          <Field label="Название роли на русском" htmlFor="role-ru" required error={fe.nameRu}>
            <Input id="role-ru" maxLength={60} value={values.nameRu} status={fe.nameRu ? 'error' : undefined} onChange={(e) => set({ nameRu: e.target.value })} />
          </Field>
        </div>
        <Field label="Описание роли" htmlFor="role-description" error={fe.description}>
          <Input.TextArea id="role-description" rows={2} maxLength={500} value={values.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div>
          <p className="m-0 mb-2 text-sm font-medium">Кому назначена роль</p>
          <Radio.Group
            aria-label="Кому назначена роль"
            value={values.scope}
            onChange={(e) => set({ scope: e.target.value as TenantRolePayload['scope'] })}
            options={[
              { value: 'DEPARTMENT', label: 'Всему отделу' },
              { value: 'MEMBERS', label: 'Конкретным сотрудникам' },
            ]}
          />
        </div>
        {values.scope === 'DEPARTMENT' ? (
          <Field label="Отдел" htmlFor="role-department" required error={fe.departmentId}>
            <Select
              id="role-department"
              aria-label="Отдел"
              style={{ width: '100%' }}
              placeholder="Выберите отдел"
              status={fe.departmentId ? 'error' : undefined}
              value={values.departmentId ?? undefined}
              options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
              onChange={(departmentId) => set({ departmentId })}
            />
          </Field>
        ) : (
          <Field label="Сотрудники" htmlFor="role-members">
            <Select
              id="role-members"
              aria-label="Сотрудники"
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="Поиск по ФИО или ИИН"
              showSearch={{ optionFilterProp: 'label' }}
              loading={members.isPending}
              value={values.memberIds}
              options={memberOptions(members.data ?? [])}
              onChange={(memberIds) => set({ memberIds })}
            />
          </Field>
        )}
        <div>
          <p className="m-0 mb-2 text-sm font-medium">
            Матрица доступов <span className="font-normal text-muted">· включено опций: {values.matrix.length}</span>
          </p>
          {fe.matrix && <Alert className="mb-2" type="error" showIcon title={fe.matrix} />}
          <OptionMatrix catalog={catalog} selected={values.matrix} onChange={(matrix) => set({ matrix })} />
        </div>
        {other && <Alert type="error" showIcon title={other} />}
      </div>
    </Modal>
  );
}

/** Раздел «Роли и доступы» организации: 3 системные роли (только просмотр) и роли компании */
export function TenantRolesPage() {
  const { clientSlug } = useCabinet();
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const access = user?.access ?? [];
  const q = useQuery({ queryKey: queryKeys.tenantAdmin(clientSlug, 'roles'), queryFn: () => api.tenantAdmin(clientSlug).roles() });
  const [editing, setEditing] = useState<TenantRole | 'new' | null>(null);
  const [viewing, setViewing] = useState<TenantRole | null>(null);
  const roles = q.data?.roles ?? [];
  const catalog = q.data?.catalog ?? [];

  const remove = useMutation({
    mutationFn: (r: TenantRole) => api.tenantAdmin(clientSlug).removeRole(r.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tenant-admin', clientSlug] });
      message.success('Роль удалена');
    },
    onError: (e) => message.error(e.message),
  });

  const columns = (custom: boolean) => [
    {
      title: 'Роль',
      key: 'name',
      render: (_: unknown, r: TenantRole) => (
        <div>
          <div className="font-medium">{r.nameRu}</div>
          {custom && <div className="text-xs text-muted">{r.nameKz}</div>}
          {r.description && <div className="text-xs text-muted">{r.description}</div>}
        </div>
      ),
    },
    {
      title: 'Модулей / опций',
      key: 'matrix',
      width: 150,
      render: (_: unknown, r: TenantRole) => `${modulesOf(r.matrix).length} / ${r.matrix.length}`,
    },
    { title: 'Сотрудников', dataIndex: 'employeesCount', key: 'employees', width: 120, align: 'right' as const },
    {
      title: '',
      key: 'actions',
      width: 110,
      render: (_: unknown, r: TenantRole) => (
        <span className="inline-flex gap-1">
          {r.isSystem && <IconButton type="text" label={`Матрица прав: ${r.nameRu}`} icon={<Eye size={16} />} onClick={() => setViewing(r)} />}
          {!r.isSystem && access.includes('lms_roles.edit') && (
            <IconButton type="text" label={`Редактировать роль: ${r.nameRu}`} icon={<Pencil size={16} />} onClick={() => setEditing(r)} />
          )}
          {!r.isSystem && access.includes('lms_roles.delete') && (
            <IconButton
              type="text"
              danger
              label={`Удалить роль: ${r.nameRu}`}
              icon={<Trash2 size={16} />}
              onClick={() =>
                modal.confirm({
                  title: `Удалить роль «${r.nameRu}»?`,
                  content: 'Сотрудники потеряют права, которые давала эта роль.',
                  okText: 'Удалить',
                  cancelText: 'Отмена',
                  okButtonProps: { danger: true },
                  onOk: () => remove.mutate(r),
                })
              }
            />
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Роли и доступы" subtitle="Системные роли и собственные роли компании. Доступны только модули и опции вашего тарифа." />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <div className="flex flex-col gap-6">
          <Card
            title="Системные роли"
            extra={
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <Lock size={12} aria-hidden /> Изменение запрещено
              </span>
            }
            styles={{ body: { padding: 0 } }}
            data-testid="system-roles"
          >
            <Table<TenantRole> rowKey="id" loading={q.isPending} dataSource={roles.filter((r) => r.isSystem)} pagination={false} scroll={{ x: 640 }} columns={columns(false)} />
          </Card>
          <Card
            title="Роли компании"
            extra={
              access.includes('lms_roles.create') && (
                <Button type="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
                  Создать роль
                </Button>
              )
            }
            styles={{ body: { padding: 0 } }}
            data-testid="company-roles"
          >
            <Table<TenantRole>
              rowKey="id"
              loading={q.isPending}
              dataSource={roles.filter((r) => !r.isSystem)}
              pagination={false}
              scroll={{ x: 640 }}
              locale={{ emptyText: 'Собственных ролей пока нет' }}
              columns={columns(true)}
            />
          </Card>
        </div>
      )}
      {editing && <RoleModal clientSlug={clientSlug} role={editing === 'new' ? null : editing} catalog={catalog} onClose={() => setEditing(null)} />}
      {viewing && (
        <Modal open width={720} title={`Матрица прав: ${viewing.nameRu}`} footer={null} onCancel={() => setViewing(null)} destroyOnHidden>
          <div className="flex flex-col gap-3 pt-2">
            <Tag className="self-start" icon={<Lock size={12} className="mr-1 inline" aria-hidden />}>
              Системная роль: только просмотр
            </Tag>
            <OptionMatrix catalog={catalog} selected={viewing.matrix} />
          </div>
        </Modal>
      )}
    </>
  );
}
