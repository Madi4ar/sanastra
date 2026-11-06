import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, DatePicker, Input, InputNumber, Modal, Select, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { Copy, Pencil, Plus, RefreshCw, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useState } from 'react';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { GroupStatus, OrgGroup, OrgGroupPayload } from '@/api/types';
import { useCurrentUser } from '@/auth/auth';
import { useDirectoryOptions } from '@/features/directories/useDirectoryOptions';
import { useCabinet } from '@/features/tenant/cabinet';
import { API_DATE, formatDate, UI_DATE } from '@/shared/format';
import { Field } from '@/shared/FormField';
import { IconButton } from '@/shared/IconButton';
import { ErrorState } from '@/shared/PageState';
import { useDebouncedValue } from '@/shared/useDebouncedValue';
import { PageHeader } from './PageHeader';

const STATUS: Record<GroupStatus, { label: string; color?: string }> = {
  RECRUITING: { label: 'Набор открыт', color: 'blue' },
  IN_PROGRESS: { label: 'В процессе обучения', color: 'green' },
  COMPLETED: { label: 'Завершено' },
  ARCHIVED: { label: 'Архив' },
};
const STATUS_OPTIONS = (Object.keys(STATUS) as GroupStatus[]).map((value) => ({ value, label: STATUS[value].label }));

const newHash = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');

function useGroupOptions(clientSlug: string) {
  return useQuery({
    queryKey: queryKeys.tenantAdmin(clientSlug, 'group-options'),
    queryFn: () => api.tenantAdmin(clientSlug).groupOptions(),
  });
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function GroupModal({ group, onClose }: { group: OrgGroup | null; onClose: () => void }) {
  const { clientSlug } = useCabinet();
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const admin = api.tenantAdmin(clientSlug);
  const options = useGroupOptions(clientSlug);
  const formats = useDirectoryOptions(clientSlug, 'course_format');
  const canInvite = Boolean(user?.access.includes('lms_groups.invite_link'));
  const [values, setValues] = useState<OrgGroupPayload>({
    academicYear: group?.academicYear ?? null,
    departmentId: group?.departmentId ?? null,
    formatId: group?.formatId ?? null,
    courseId: group?.courseId ?? null,
    trainerIds: group?.trainerIds.length ? group.trainerIds : [''],
    listenersLimit: group?.listenersLimit ?? null,
    startDate: group?.startDate ?? null,
    endDate: group?.endDate ?? null,
    status: group?.status ?? 'RECRUITING',
    inviteHash: group?.inviteHash ?? (canInvite ? newHash() : null),
  });
  const set = (patch: Partial<OrgGroupPayload>) => {
    setValues((v) => ({ ...v, ...patch }));
    // Ошибки проверки относятся к прошлой попытке сохранения
    save.reset();
  };
  const save = useMutation({
    mutationFn: () => {
      const payload = { ...values, trainerIds: values.trainerIds.filter(Boolean) };
      return group ? admin.updateGroup(group.id, payload) : admin.createGroup(payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.tenantAdmin(clientSlug, 'groups') });
      message.success(group ? 'Группа сохранена' : 'Группа создана');
      onClose();
    },
  });
  const fe = isApiError(save.error) ? save.error.fieldErrors : {};
  const other = save.isError && !Object.keys(fe).length ? save.error.message : null;
  const inviteUrl = values.inviteHash ? `https://${clientSlug}.beyim.kz/invite/group/${values.inviteHash}` : '';
  const trainerOptions = (current: string) =>
    (options.data?.trainers ?? [])
      .filter((t) => (t.active || t.id === current) && (t.id === current || !values.trainerIds.includes(t.id)))
      .map((t) => ({ value: t.id, label: t.active ? t.fullName : `${t.fullName} (деактивирован)` }));

  return (
    <Modal
      open
      width={680}
      title={group ? `Редактирование: ${group.name}` : 'Новая группа'}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={save.isPending}
      onOk={() => save.mutate()}
      onCancel={onClose}
      maskClosable={false}
      destroyOnHidden
    >
      <div className="grid gap-4 pt-2 sm:grid-cols-2" data-testid="group-form">
        <Field label="Учебный год" htmlFor="group-year" required error={fe.academicYear}>
          <Select
            id="group-year"
            aria-label="Учебный год"
            style={{ width: '100%' }}
            placeholder="Выберите год"
            status={fe.academicYear ? 'error' : undefined}
            value={values.academicYear ?? undefined}
            options={(options.data?.academicYears ?? []).map((y) => ({ value: y, label: y }))}
            onChange={(academicYear) => set({ academicYear })}
          />
        </Field>
        <Field label="Филиал или отдел" htmlFor="group-department" error={fe.departmentId}>
          <Select
            id="group-department"
            aria-label="Филиал или отдел"
            allowClear
            style={{ width: '100%' }}
            placeholder="Не выбран"
            showSearch={{ optionFilterProp: 'label' }}
            value={values.departmentId ?? undefined}
            options={(options.data?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
            onChange={(v) => set({ departmentId: v ?? null })}
          />
        </Field>
        <Field label="Учебная программа" htmlFor="group-course" required error={fe.courseId}>
          <Select
            id="group-course"
            aria-label="Учебная программа"
            style={{ width: '100%' }}
            placeholder="Выберите программу"
            showSearch={{ optionFilterProp: 'label' }}
            status={fe.courseId ? 'error' : undefined}
            value={values.courseId ?? undefined}
            options={(options.data?.programs ?? []).map((p) => ({ value: p.id, label: p.title }))}
            onChange={(courseId) => {
              const program = options.data?.programs.find((p) => p.id === courseId);
              set({ courseId, formatId: values.formatId ?? program?.formatId ?? null });
            }}
          />
        </Field>
        <Field label="Формат курса" htmlFor="group-format" required error={fe.formatId}>
          <Select
            id="group-format"
            aria-label="Формат курса"
            style={{ width: '100%' }}
            placeholder="Выберите формат"
            status={fe.formatId ? 'error' : undefined}
            value={values.formatId ?? undefined}
            options={formats.data ?? []}
            onChange={(formatId) => set({ formatId })}
          />
        </Field>
        <div className="sm:col-span-2">
          <p className="m-0 mb-1.5 text-sm font-medium">Тренер(ы)</p>
          <div className="flex flex-col gap-2" data-testid="group-trainers">
            {values.trainerIds.map((id, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  aria-label={`Тренер ${i + 1}`}
                  allowClear
                  style={{ width: '100%' }}
                  placeholder="Выберите из тренерского состава"
                  showSearch={{ optionFilterProp: 'label' }}
                  value={id || undefined}
                  options={trainerOptions(id)}
                  onChange={(v) => set({ trainerIds: values.trainerIds.map((x, j) => (j === i ? (v ?? '') : x)) })}
                />
                {values.trainerIds.length > 1 && (
                  <IconButton type="text" label={`Убрать тренера ${i + 1}`} icon={<X size={14} />} onClick={() => set({ trainerIds: values.trainerIds.filter((_, j) => j !== i) })} />
                )}
              </div>
            ))}
          </div>
          {fe.trainerIds && (
            <p role="alert" className="m-0 mt-1 text-xs text-error">
              {fe.trainerIds}
            </p>
          )}
          <Button className="mt-2" size="small" icon={<Plus size={14} />} onClick={() => set({ trainerIds: [...values.trainerIds, ''] })}>
            Добавить тренера
          </Button>
        </div>
        <Field label="Количество слушателей" htmlFor="group-limit" required error={fe.listenersLimit} hint="Планируемый лимит участников">
          <InputNumber
            id="group-limit"
            style={{ width: '100%' }}
            min={1}
            precision={0}
            status={fe.listenersLimit ? 'error' : undefined}
            value={values.listenersLimit}
            onChange={(v) => set({ listenersLimit: v === null ? null : Number(v) })}
          />
        </Field>
        <Field label="Статус группы" htmlFor="group-status" required error={fe.status}>
          <Select id="group-status" aria-label="Статус группы" style={{ width: '100%' }} value={values.status} options={STATUS_OPTIONS} onChange={(status) => set({ status })} />
        </Field>
        <Field label="Дата начала" htmlFor="group-start" required error={fe.startDate}>
          <DatePicker
            id="group-start"
            className="w-full"
            format={UI_DATE}
            status={fe.startDate ? 'error' : undefined}
            value={values.startDate ? dayjs(values.startDate) : null}
            onChange={(d) => set({ startDate: d ? d.format(API_DATE) : null })}
          />
        </Field>
        <Field label="Дата окончания" htmlFor="group-end" required error={fe.endDate} hint="Строго позже даты начала">
          <DatePicker
            id="group-end"
            className="w-full"
            format={UI_DATE}
            status={fe.endDate ? 'error' : undefined}
            value={values.endDate ? dayjs(values.endDate) : null}
            onChange={(d) => set({ endDate: d ? d.format(API_DATE) : null })}
          />
        </Field>
        {canInvite && (
          <div className="sm:col-span-2">
            <Field label="Пригласительная ссылка для слушателей" htmlFor="group-invite">
              <div className="flex gap-2">
                <Input id="group-invite" readOnly className="mono" value={inviteUrl} />
                <Button
                  icon={<Copy size={16} />}
                  onClick={() =>
                    void copyText(inviteUrl).then((ok) =>
                      ok ? message.success('Ссылка скопирована в буфер обмена') : message.error('Не удалось скопировать ссылку'),
                    )
                  }
                >
                  Копировать ссылку
                </Button>
                <IconButton label="Сгенерировать новую ссылку" icon={<RefreshCw size={16} />} onClick={() => set({ inviteHash: newHash() })} />
              </div>
            </Field>
          </div>
        )}
        {other && <Alert className="sm:col-span-2" type="error" showIcon title={other} />}
      </div>
    </Modal>
  );
}

/** Ведомость: состав участников группы */
function ListenersModal({ group, canManage, onClose }: { group: OrgGroup; canManage: boolean; onClose: () => void }) {
  const { clientSlug } = useCabinet();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const admin = api.tenantAdmin(clientSlug);
  const key = queryKeys.tenantAdmin(clientSlug, `group-listeners:${group.id}`);
  const q = useQuery({ queryKey: key, queryFn: () => admin.groupListeners(group.id) });
  const remove = useMutation({
    mutationFn: (id: string) => admin.removeListener(group.id, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: queryKeys.tenantAdmin(clientSlug, 'groups') });
    },
    onError: (e) => message.error(e.message),
  });
  return (
    <Modal open width={720} title={`Слушатели: ${group.name}`} footer={null} onCancel={onClose} destroyOnHidden>
      <div className="pt-2" data-testid="group-listeners">
        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : (
          <Table
            rowKey="id"
            size="small"
            loading={q.isPending}
            dataSource={q.data}
            pagination={false}
            scroll={{ y: 400 }}
            locale={{ emptyText: 'В группе пока нет слушателей' }}
            columns={[
              { title: 'ФИО', dataIndex: 'fullName', key: 'name' },
              { title: 'ИИН', dataIndex: 'iin', key: 'iin', width: 140, render: (v: string) => <span className="mono">{v}</span> },
              { title: 'Email', dataIndex: 'email', key: 'email' },
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
        )}
      </div>
    </Modal>
  );
}

/** Быстрое зачисление по ИИН или ФИО/Email без пригласительной ссылки */
function AddListenerModal({ group, onClose }: { group: OrgGroup; onClose: () => void }) {
  const { clientSlug } = useCabinet();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const admin = api.tenantAdmin(clientSlug);
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim(), 300);
  const ready = q.length >= 3;
  const search = useQuery({
    queryKey: queryKeys.tenantAdmin(clientSlug, `group-candidates:${group.id}:${q}`),
    queryFn: () => admin.groupCandidates(group.id, q),
    enabled: ready,
  });
  const add = useMutation({
    mutationFn: (id: string) => admin.addListeners(group.id, [id]),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tenant-admin', clientSlug] });
      message.success('Слушатель зачислен в группу');
    },
    onError: (e) => message.error(e.message),
  });
  return (
    <Modal open width={600} title={`Добавить слушателя: ${group.name}`} footer={null} onCancel={onClose} destroyOnHidden>
      <div className="flex flex-col gap-4 pt-2" data-testid="group-add-listener">
        <Field label="ИИН, ФИО или Email" htmlFor="listener-query" hint="От 3 символов. Поиск среди пользователей вашей организации.">
          <Input id="listener-query" autoFocus allowClear value={query} onChange={(e) => setQuery(e.target.value)} />
        </Field>
        {ready && search.data?.length === 0 && <Alert type="info" showIcon title="Никого не найдено. Новых пользователей создают в разделе «Пользователи»." />}
        {ready && Boolean(search.data?.length) && (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {search.data!.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.fullName}</span>
                  <span className="text-xs text-muted">
                    {c.iin} · {c.email}
                  </span>
                </span>
                <Button size="small" type="primary" loading={add.isPending && add.variables === c.id} onClick={() => add.mutate(c.id)}>
                  Зачислить
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

/** Раздел «Группы»: реестр с фильтрами, слушатели и пригласительная ссылка */
export function GroupsPage() {
  const { clientSlug } = useCabinet();
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const access = user?.access ?? [];
  const q = useQuery({ queryKey: queryKeys.tenantAdmin(clientSlug, 'groups'), queryFn: () => api.tenantAdmin(clientSlug).groups() });
  const options = useGroupOptions(clientSlug);
  const formats = useDirectoryOptions(clientSlug, 'course_format');
  const [editing, setEditing] = useState<OrgGroup | 'new' | null>(null);
  const [listeners, setListeners] = useState<OrgGroup | null>(null);
  const [adding, setAdding] = useState<OrgGroup | null>(null);
  const [f, setF] = useState<{ year?: string; department?: string; format?: string; course?: string; status?: GroupStatus; trainer?: string }>({});
  const groups = q.data ?? [];
  const visible = groups
    .filter((g) => !f.year || g.academicYear === f.year)
    .filter((g) => !f.department || g.departmentId === f.department)
    .filter((g) => !f.format || g.formatId === f.format)
    .filter((g) => !f.course || g.courseId === f.course)
    .filter((g) => !f.status || g.status === f.status)
    .filter((g) => !f.trainer || g.trainerIds.includes(f.trainer));
  const filtered = Object.values(f).some(Boolean);

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
        subtitle="Учебные группы, их программы, тренеры и слушатели."
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
          <div className="flex flex-wrap items-center gap-3 p-4" data-testid="groups-filters">
            <Select aria-label="Фильтр: учебный год" allowClear placeholder="Учебный год" style={{ minWidth: 140 }} value={f.year} options={(options.data?.academicYears ?? []).map((y) => ({ value: y, label: y }))} onChange={(year) => setF({ ...f, year })} />
            <Select aria-label="Фильтр: филиал или отдел" allowClear placeholder="Филиал / отдел" style={{ minWidth: 160 }} value={f.department} options={(options.data?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))} onChange={(department) => setF({ ...f, department })} />
            <Select aria-label="Фильтр: формат" allowClear placeholder="Формат курса" style={{ minWidth: 140 }} value={f.format} options={formats.data ?? []} onChange={(format) => setF({ ...f, format })} />
            <Select aria-label="Фильтр: программа" allowClear placeholder="Учебная программа" style={{ minWidth: 180 }} showSearch={{ optionFilterProp: 'label' }} value={f.course} options={(options.data?.programs ?? []).map((p) => ({ value: p.id, label: p.title }))} onChange={(course) => setF({ ...f, course })} />
            <Select aria-label="Фильтр: статус" allowClear placeholder="Статус группы" style={{ minWidth: 170 }} value={f.status} options={STATUS_OPTIONS} onChange={(status) => setF({ ...f, status })} />
            <Select aria-label="Фильтр: тренер" allowClear placeholder="Тренер" style={{ minWidth: 170 }} showSearch={{ optionFilterProp: 'label' }} value={f.trainer} options={(options.data?.trainers ?? []).map((t) => ({ value: t.id, label: t.fullName }))} onChange={(trainer) => setF({ ...f, trainer })} />
            {filtered && (
              <Button type="link" className="px-0" onClick={() => setF({})}>
                Сбросить
              </Button>
            )}
            <span className="ml-auto text-sm text-muted" data-testid="groups-count">
              Показано: {visible.length} из {groups.length}
            </span>
          </div>
          <Table<OrgGroup>
            rowKey="id"
            loading={q.isPending}
            dataSource={visible}
            pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
            scroll={{ x: 1240 }}
            locale={{ emptyText: filtered ? 'Ничего не найдено, измените фильтры' : 'Групп пока нет' }}
            columns={[
              { title: 'Группа', dataIndex: 'name', key: 'name', width: 110, render: (v: string) => <span className="font-medium">{v}</span> },
              { title: 'Учебный год', dataIndex: 'academicYear', key: 'year', width: 120 },
              { title: 'Филиал / отдел', key: 'department', render: (_, g) => g.departmentName ?? <span className="text-muted">—</span> },
              { title: 'Формат', key: 'format', width: 110, render: (_, g) => g.formatName ?? '—' },
              { title: 'Программа', key: 'course', render: (_, g) => g.courseTitle ?? <span className="text-muted">Не привязана</span> },
              { title: 'Тренеры', key: 'trainers', render: (_, g) => (g.trainerNames.length ? g.trainerNames.join(', ') : <span className="text-muted">—</span>) },
              { title: 'Слушатели', key: 'count', width: 100, render: (_, g) => `${g.listenerIds.length} / ${g.listenersLimit}` },
              { title: 'Период', key: 'period', width: 190, render: (_, g) => `${formatDate(g.startDate)} – ${formatDate(g.endDate)}` },
              { title: 'Статус', key: 'status', width: 170, render: (_, g) => <Tag color={STATUS[g.status].color}>{STATUS[g.status].label}</Tag> },
              {
                title: '',
                key: 'actions',
                width: 170,
                render: (_, g) => (
                  <span className="inline-flex gap-1">
                    {access.includes('lms_groups.listeners_view') && (
                      <IconButton type="text" label={`Список слушателей: ${g.name}`} icon={<Users size={16} />} onClick={() => setListeners(g)} />
                    )}
                    {access.includes('lms_groups.add_members_manual') && (
                      <IconButton type="text" label={`Добавить слушателя: ${g.name}`} icon={<UserPlus size={16} />} onClick={() => setAdding(g)} />
                    )}
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
                            title: `Удалить «${g.name}»?`,
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
      {editing && <GroupModal group={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {listeners && <ListenersModal group={listeners} canManage={access.includes('lms_groups.add_members_manual')} onClose={() => setListeners(null)} />}
      {adding && <AddListenerModal group={adding} onClose={() => setAdding(null)} />}
    </>
  );
}
