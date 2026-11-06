import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Input, Modal, Select, Table, Tag } from 'antd';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { DepartmentKind, OrgDepartment, OrgDepartmentPayload } from '@/api/types';
import { useCurrentUser } from '@/auth/auth';
import { memberOptions, useMembers } from '@/features/tenant-admin/MembersSection';
import { useCabinet } from '@/features/tenant/cabinet';
import { Field } from '@/shared/FormField';
import { IconButton } from '@/shared/IconButton';
import { ErrorState } from '@/shared/PageState';
import { PageHeader } from './PageHeader';

const KIND_LABEL: Record<DepartmentKind, string> = {
  DEPARTMENT: 'Департамент',
  MANAGEMENT: 'Управление',
  BRANCH: 'Филиал',
  UNIT: 'Отдел',
};

interface Row extends OrgDepartment {
  children?: Row[];
}

function toTree(list: OrgDepartment[], parentId: string | null = null): Row[] {
  return list
    .filter((d) => d.parentId === parentId)
    .map((d) => {
      const children = toTree(list, d.id);
      return children.length ? { ...d, children } : d;
    });
}

/** Подразделение и все вложенные — их нельзя выбрать родителем */
function subtree(list: OrgDepartment[], id: string): Set<string> {
  const ids = new Set([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const d of list)
      if (d.parentId && ids.has(d.parentId) && !ids.has(d.id)) {
        ids.add(d.id);
        grew = true;
      }
  }
  return ids;
}

function DepartmentModal({
  clientSlug,
  list,
  department,
  parentId,
  onClose,
}: {
  clientSlug: string;
  list: OrgDepartment[];
  department: OrgDepartment | null;
  parentId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const admin = api.tenantAdmin(clientSlug);
  const members = useMembers(clientSlug);
  const [values, setValues] = useState<OrgDepartmentPayload>({
    name: department?.name ?? '',
    kind: department?.kind ?? 'UNIT',
    parentId: department ? department.parentId : parentId,
    headMemberId: department?.headMemberId ?? null,
  });
  const set = (patch: Partial<OrgDepartmentPayload>) => setValues((v) => ({ ...v, ...patch }));
  const excluded = department ? subtree(list, department.id) : new Set<string>();
  const save = useMutation({
    mutationFn: () => (department ? admin.updateDepartment(department.id, values) : admin.createDepartment(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tenant-admin', clientSlug] });
      onClose();
    },
  });
  const fe = isApiError(save.error) ? save.error.fieldErrors : {};
  return (
    <Modal
      open
      title={department ? 'Редактирование подразделения' : 'Новое подразделение'}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={save.isPending}
      onOk={() => save.mutate()}
      onCancel={onClose}
      destroyOnHidden
    >
      <div className="flex flex-col gap-4 pt-2">
        <Field label="Название" htmlFor="dept-name" required error={fe.name}>
          <Input id="dept-name" autoFocus maxLength={120} value={values.name} status={fe.name ? 'error' : undefined} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Тип" htmlFor="dept-kind" required error={fe.kind}>
          <Select
            id="dept-kind"
            aria-label="Тип"
            style={{ width: '100%' }}
            value={values.kind}
            options={(Object.keys(KIND_LABEL) as DepartmentKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
            onChange={(kind) => set({ kind })}
          />
        </Field>
        <Field label="Входит в" htmlFor="dept-parent" error={fe.parentId}>
          <Select
            id="dept-parent"
            aria-label="Входит в"
            allowClear
            style={{ width: '100%' }}
            placeholder="Верхний уровень"
            value={values.parentId ?? undefined}
            options={list.filter((d) => !excluded.has(d.id)).map((d) => ({ value: d.id, label: d.name }))}
            onChange={(v) => set({ parentId: v ?? null })}
          />
        </Field>
        <Field label="Руководитель" htmlFor="dept-head" error={fe.headMemberId}>
          <Select
            id="dept-head"
            aria-label="Руководитель"
            allowClear
            style={{ width: '100%' }}
            placeholder="Не назначен"
            showSearch={{ optionFilterProp: 'label' }}
            loading={members.isPending}
            value={values.headMemberId ?? undefined}
            options={memberOptions(members.data ?? [])}
            onChange={(v) => set({ headMemberId: v ?? null })}
          />
        </Field>
        {save.isError && !Object.keys(fe).length && <Alert type="error" showIcon title={save.error.message} />}
      </div>
    </Modal>
  );
}

function BindMembersModal({ clientSlug, department, onClose }: { clientSlug: string; department: OrgDepartment; onClose: () => void }) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const members = useMembers(clientSlug);
  const [ids, setIds] = useState<string[]>([]);
  const bind = useMutation({
    mutationFn: () => api.tenantAdmin(clientSlug).bindMembers(department.id, ids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tenant-admin', clientSlug] });
      message.success(`Сотрудников привязано: ${ids.length}`);
      onClose();
    },
    onError: (e) => message.error(e.message),
  });
  const others = (members.data ?? []).filter((m) => m.departmentId !== department.id);
  return (
    <Modal
      open
      title={`Привязать сотрудников: ${department.name}`}
      okText="Привязать"
      cancelText="Отмена"
      confirmLoading={bind.isPending}
      okButtonProps={{ disabled: !ids.length }}
      onOk={() => bind.mutate()}
      onCancel={onClose}
      destroyOnHidden
    >
      <div className="pt-2">
        <Field label="Сотрудники" htmlFor="bind-members" hint="Сотрудник переходит в это подразделение из прежнего.">
          <Select
            id="bind-members"
            aria-label="Сотрудники"
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="Поиск по ФИО, ИИН или Email"
            showSearch={{ optionFilterProp: 'label' }}
            loading={members.isPending}
            value={ids}
            options={memberOptions(others)}
            onChange={setIds}
          />
        </Field>
      </div>
    </Modal>
  );
}

/** Раздел «Отделы»: древовидная структура, руководители, массовая привязка сотрудников */
export function DepartmentsPage() {
  const { clientSlug } = useCabinet();
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const access = user?.access ?? [];
  const q = useQuery({ queryKey: queryKeys.tenantAdmin(clientSlug, 'departments'), queryFn: () => api.tenantAdmin(clientSlug).departments() });
  const [editing, setEditing] = useState<{ department: OrgDepartment | null; parentId: string | null } | null>(null);
  const [binding, setBinding] = useState<OrgDepartment | null>(null);
  const tree = useMemo(() => toTree(q.data ?? []), [q.data]);

  const remove = useMutation({
    mutationFn: (d: OrgDepartment) => api.tenantAdmin(clientSlug).removeDepartment(d.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tenant-admin', clientSlug] });
      message.success('Подразделение удалено');
    },
    onError: (e) => message.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Отделы"
        subtitle="Организационная структура компании: департаменты, управления, филиалы и отделы."
        extra={
          access.includes('lms_departments.create_structure') && (
            <Button type="primary" icon={<Plus size={16} />} onClick={() => setEditing({ department: null, parentId: null })}>
              Добавить подразделение
            </Button>
          )
        }
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <Card styles={{ body: { padding: 0 } }} data-testid="departments">
          <Table<Row>
            rowKey="id"
            loading={q.isPending}
            dataSource={tree}
            pagination={false}
            scroll={{ x: 820 }}
            expandable={{ defaultExpandAllRows: true }}
            key={tree.length ? 'loaded' : 'empty'}
            locale={{ emptyText: 'Структура пока не создана' }}
            columns={[
              { title: 'Подразделение', dataIndex: 'name', key: 'name', render: (v: string) => <span className="font-medium">{v}</span> },
              { title: 'Тип', key: 'kind', width: 140, render: (_, d) => <Tag>{KIND_LABEL[d.kind]}</Tag> },
              { title: 'Руководитель', key: 'head', render: (_, d) => d.headName ?? <span className="text-muted">Не назначен</span> },
              { title: 'Сотрудников', dataIndex: 'membersCount', key: 'members', width: 120, align: 'right' },
              {
                title: '',
                key: 'actions',
                width: 170,
                render: (_, d) => (
                  <span className="inline-flex gap-1">
                    {access.includes('lms_departments.create_structure') && (
                      <IconButton type="text" label={`Добавить внутрь: ${d.name}`} icon={<Plus size={16} />} onClick={() => setEditing({ department: null, parentId: d.id })} />
                    )}
                    {access.includes('lms_departments.bind_users') && (
                      <IconButton type="text" label={`Привязать сотрудников: ${d.name}`} icon={<Users size={16} />} onClick={() => setBinding(d)} />
                    )}
                    {access.includes('lms_departments.edit') && (
                      <IconButton type="text" label={`Редактировать: ${d.name}`} icon={<Pencil size={16} />} onClick={() => setEditing({ department: d, parentId: d.parentId })} />
                    )}
                    {access.includes('lms_departments.delete') && (
                      <IconButton
                        type="text"
                        danger
                        label={`Удалить: ${d.name}`}
                        icon={<Trash2 size={16} />}
                        onClick={() =>
                          modal.confirm({
                            title: `Удалить «${d.name}»?`,
                            content: 'Сотрудники подразделения останутся без отдела.',
                            okText: 'Удалить',
                            cancelText: 'Отмена',
                            okButtonProps: { danger: true },
                            onOk: () => remove.mutate(d),
                          })
                        }
                      />
                    )}
                  </span>
                ),
              },
            ]}
          />
        </Card>
      )}
      {editing && (
        <DepartmentModal clientSlug={clientSlug} list={q.data ?? []} department={editing.department} parentId={editing.parentId} onClose={() => setEditing(null)} />
      )}
      {binding && <BindMembersModal clientSlug={clientSlug} department={binding} onClose={() => setBinding(null)} />}
    </>
  );
}
