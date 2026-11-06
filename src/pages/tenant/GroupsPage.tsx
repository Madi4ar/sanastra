import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Checkbox, DatePicker, Drawer, Input, Modal, Select, Table } from 'antd';
import dayjs from 'dayjs';
import { Pencil, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { OrgGroup, OrgGroupPayload } from '@/api/types';
import { useCurrentUser } from '@/auth/auth';
import { memberOptions, useMembers } from '@/features/tenant-admin/MembersSection';
import { useCabinet } from '@/features/tenant/cabinet';
import { API_DATE, formatDate, UI_DATE } from '@/shared/format';
import { Field } from '@/shared/FormField';
import { IconButton } from '@/shared/IconButton';
import { ErrorState } from '@/shared/PageState';
import { PageHeader } from './PageHeader';

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const scheduleText = (g: OrgGroup) => {
  const period = g.startDate || g.endDate ? `${formatDate(g.startDate)} – ${formatDate(g.endDate)}` : '';
  const days = [...g.days].sort((a, b) => a - b).map((d) => DAYS[d]).join(', ');
  const time = g.timeFrom && g.timeTo ? `${g.timeFrom}–${g.timeTo}` : '';
  return [period, days, time].filter(Boolean).join(' · ') || 'Не задано';
};

function useCourses(clientSlug: string) {
  return useQuery({
    queryKey: queryKeys.tenantModuleData(clientSlug, 'COURSES'),
    queryFn: () => api.tenant.moduleData(clientSlug, 'COURSES'),
    retry: false,
  });
}

function GroupModal({ clientSlug, group, onClose }: { clientSlug: string; group: OrgGroup | null; onClose: () => void }) {
  const qc = useQueryClient();
  const admin = api.tenantAdmin(clientSlug);
  const courses = useCourses(clientSlug);
  const [values, setValues] = useState<OrgGroupPayload>({
    name: group?.name ?? '',
    courseId: group?.courseId ?? null,
    startDate: group?.startDate ?? null,
    endDate: group?.endDate ?? null,
    days: group?.days ?? [],
    timeFrom: group?.timeFrom ?? null,
    timeTo: group?.timeTo ?? null,
  });
  const set = (patch: Partial<OrgGroupPayload>) => setValues((v) => ({ ...v, ...patch }));
  const save = useMutation({
    mutationFn: () => (group ? admin.updateGroup(group.id, values) : admin.createGroup(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tenant-admin', clientSlug] });
      onClose();
    },
  });
  const fe = isApiError(save.error) ? save.error.fieldErrors : {};
  const other = save.isError && !Object.keys(fe).length ? save.error.message : null;
  return (
    <Modal
      open
      width={620}
      title={group ? 'Редактирование группы' : 'Новая группа'}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={save.isPending}
      onOk={() => save.mutate()}
      onCancel={onClose}
      destroyOnHidden
    >
      <div className="flex flex-col gap-4 pt-2" data-testid="group-form">
        <Field label="Название группы" htmlFor="group-name" required error={fe.name}>
          <Input id="group-name" autoFocus maxLength={120} value={values.name} status={fe.name ? 'error' : undefined} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Учебная программа" htmlFor="group-course" error={fe.courseId}>
          <Select
            id="group-course"
            aria-label="Учебная программа"
            allowClear
            style={{ width: '100%' }}
            placeholder="Не привязана"
            showSearch={{ optionFilterProp: 'label' }}
            loading={courses.isPending}
            value={values.courseId ?? undefined}
            options={(courses.data?.courses ?? []).map((c) => ({ value: c.id, label: c.title }))}
            onChange={(v) => set({ courseId: v ?? null })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Дата начала" htmlFor="group-start" error={fe.startDate}>
            <DatePicker
              id="group-start"
              className="w-full"
              format={UI_DATE}
              value={values.startDate ? dayjs(values.startDate) : null}
              onChange={(d) => set({ startDate: d ? d.format(API_DATE) : null })}
            />
          </Field>
          <Field label="Дата окончания" htmlFor="group-end" error={fe.endDate}>
            <DatePicker
              id="group-end"
              className="w-full"
              format={UI_DATE}
              status={fe.endDate ? 'error' : undefined}
              value={values.endDate ? dayjs(values.endDate) : null}
              onChange={(d) => set({ endDate: d ? d.format(API_DATE) : null })}
            />
          </Field>
        </div>
        <div>
          <p className="m-0 mb-2 text-sm font-medium">Дни занятий</p>
          <Checkbox.Group
            aria-label="Дни занятий"
            value={values.days}
            options={DAYS.map((label, value) => ({ value, label }))}
            onChange={(days) => set({ days })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Начало, ЧЧ:ММ" htmlFor="group-from" error={fe.timeFrom}>
            <Input id="group-from" placeholder="10:00" maxLength={5} value={values.timeFrom ?? ''} status={fe.timeFrom ? 'error' : undefined} onChange={(e) => set({ timeFrom: e.target.value || null })} />
          </Field>
          <Field label="Окончание, ЧЧ:ММ" htmlFor="group-to" error={fe.timeTo}>
            <Input id="group-to" placeholder="12:00" maxLength={5} value={values.timeTo ?? ''} status={fe.timeTo ? 'error' : undefined} onChange={(e) => set({ timeTo: e.target.value || null })} />
          </Field>
        </div>
        {other && <Alert type="error" showIcon title={other} />}
      </div>
    </Modal>
  );
}

/** Слушатели группы: добавление вручную по ИИН, Email или ФИО */
function ListenersDrawer({ clientSlug, group, canManage, onClose }: { clientSlug: string; group: OrgGroup; canManage: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const admin = api.tenantAdmin(clientSlug);
  const members = useMembers(clientSlug);
  const [ids, setIds] = useState<string[]>([]);
  const [listeners, setListeners] = useState(group.listenerIds);
  const refresh = (g: OrgGroup) => {
    setListeners(g.listenerIds);
    void qc.invalidateQueries({ queryKey: queryKeys.tenantAdmin(clientSlug, 'groups') });
  };
  const add = useMutation({
    mutationFn: () => admin.addListeners(group.id, ids),
    onSuccess: (g) => {
      refresh(g);
      message.success(`Добавлено слушателей: ${ids.length}`);
      setIds([]);
    },
    onError: (e) => message.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => admin.removeListener(group.id, id),
    onSuccess: refresh,
    onError: (e) => message.error(e.message),
  });
  const all = members.data ?? [];
  const current = all.filter((m) => listeners.includes(m.id));
  const candidates = all.filter((m) => m.active && !listeners.includes(m.id));

  return (
    <Drawer open size={560} title={`Слушатели: ${group.name}`} onClose={onClose} destroyOnHidden>
      <div className="flex flex-col gap-4" data-testid="group-listeners">
        {canManage && (
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label="Добавить слушателей" htmlFor="listeners-add">
                <Select
                  id="listeners-add"
                  aria-label="Добавить слушателей"
                  mode="multiple"
                  style={{ width: '100%' }}
                  placeholder="Поиск по ИИН, Email или ФИО"
                  showSearch={{ optionFilterProp: 'label' }}
                  loading={members.isPending}
                  value={ids}
                  options={memberOptions(candidates)}
                  onChange={setIds}
                />
              </Field>
            </div>
            <Button type="primary" icon={<UserPlus size={16} />} disabled={!ids.length} loading={add.isPending} onClick={() => add.mutate()}>
              Добавить
            </Button>
          </div>
        )}
        <Table
          rowKey="id"
          size="small"
          loading={members.isPending}
          dataSource={current}
          pagination={false}
          locale={{ emptyText: 'В группе пока нет слушателей' }}
          columns={[
            { title: 'ФИО', dataIndex: 'fullName', key: 'name' },
            { title: 'ИИН', dataIndex: 'iin', key: 'iin', render: (v: string) => <span className="mono">{v}</span> },
            ...(canManage
              ? [
                  {
                    title: '',
                    key: 'remove',
                    width: 48,
                    render: (_: unknown, m: { id: string; fullName: string }) => (
                      <IconButton type="text" danger size="small" label={`Убрать из группы: ${m.fullName}`} icon={<Trash2 size={14} />} onClick={() => remove.mutate(m.id)} />
                    ),
                  },
                ]
              : []),
          ]}
        />
      </div>
    </Drawer>
  );
}

/** Раздел «Группы»: учебные группы, привязка к программам и расписанию, слушатели */
export function GroupsPage() {
  const { clientSlug } = useCabinet();
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const access = user?.access ?? [];
  const q = useQuery({ queryKey: queryKeys.tenantAdmin(clientSlug, 'groups'), queryFn: () => api.tenantAdmin(clientSlug).groups() });
  const [editing, setEditing] = useState<OrgGroup | 'new' | null>(null);
  const [listeners, setListeners] = useState<OrgGroup | null>(null);
  const canSeeMembers = access.includes('lms_users.list_view');

  const remove = useMutation({
    mutationFn: (g: OrgGroup) => api.tenantAdmin(clientSlug).removeGroup(g.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.tenantAdmin(clientSlug, 'groups') });
      message.success('Группа удалена');
    },
    onError: (e) => message.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Группы"
        subtitle="Учебные группы, их программы, расписание и слушатели."
        extra={
          access.includes('lms_groups.create') && (
            <Button type="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
              Создать группу
            </Button>
          )
        }
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <Card styles={{ body: { padding: 0 } }} data-testid="groups">
          <Table<OrgGroup>
            rowKey="id"
            loading={q.isPending}
            dataSource={q.data}
            pagination={false}
            scroll={{ x: 820 }}
            locale={{ emptyText: 'Групп пока нет' }}
            columns={[
              { title: 'Группа', dataIndex: 'name', key: 'name', render: (v: string) => <span className="font-medium">{v}</span> },
              { title: 'Учебная программа', key: 'course', render: (_, g) => g.courseTitle ?? <span className="text-muted">Не привязана</span> },
              { title: 'Расписание', key: 'schedule', render: (_, g) => scheduleText(g) },
              { title: 'Слушателей', key: 'count', width: 110, align: 'right', render: (_, g) => g.listenerIds.length },
              {
                title: '',
                key: 'actions',
                width: 130,
                render: (_, g) => (
                  <span className="inline-flex gap-1">
                    {canSeeMembers && <IconButton type="text" label={`Слушатели: ${g.name}`} icon={<Users size={16} />} onClick={() => setListeners(g)} />}
                    {access.includes('lms_groups.edit') && (
                      <IconButton type="text" label={`Редактировать: ${g.name}`} icon={<Pencil size={16} />} onClick={() => setEditing(g)} />
                    )}
                    {access.includes('lms_groups.delete') && (
                      <IconButton
                        type="text"
                        danger
                        label={`Удалить: ${g.name}`}
                        icon={<Trash2 size={16} />}
                        onClick={() =>
                          modal.confirm({
                            title: `Удалить группу «${g.name}»?`,
                            content: 'Слушатели останутся в организации, но будут исключены из группы.',
                            okText: 'Удалить',
                            cancelText: 'Отмена',
                            okButtonProps: { danger: true },
                            onOk: () => remove.mutate(g),
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
      {editing && <GroupModal clientSlug={clientSlug} group={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {listeners && (
        <ListenersDrawer
          clientSlug={clientSlug}
          group={listeners}
          canManage={access.includes('lms_groups.add_members_manual')}
          onClose={() => setListeners(null)}
        />
      )}
    </>
  );
}
