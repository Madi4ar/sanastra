import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Input, Modal, Select, Table, Tag } from 'antd';
import { Pencil, Power, PowerOff, Search, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { OrgMember, OrgMemberPayload, SystemOrgRole } from '@/api/types';
import { useCurrentUser } from '@/auth/auth';
import { ROLE_LABEL } from '@/features/auth/roles';
import { formatPhone } from '@/features/auth/validation';
import { AssignRoleModal } from '@/features/users/OrganizationUsers';
import { Field } from '@/shared/FormField';
import { IconButton } from '@/shared/IconButton';
import { ErrorState } from '@/shared/PageState';

const ROLE_OPTIONS: { value: SystemOrgRole; label: string }[] = [
  { value: 'LEARNER', label: ROLE_LABEL.LEARNER },
  { value: 'TRAINER', label: ROLE_LABEL.TRAINER },
  { value: 'ORGANIZATION_ADMIN', label: ROLE_LABEL.ORGANIZATION_ADMIN },
];

export function useMembers(clientSlug: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenantAdmin(clientSlug, 'members'),
    queryFn: () => api.tenantAdmin(clientSlug).members(),
    enabled,
  });
}

export const memberOptions = (members: OrgMember[]) =>
  members.map((m) => ({ value: m.id, label: `${m.fullName} · ${m.iin} · ${m.email}` }));

function MemberModal({ clientSlug, member, preset, onClose }: { clientSlug: string; member: OrgMember | null; preset?: { iin: string; role: SystemOrgRole }; onClose: () => void }) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const admin = api.tenantAdmin(clientSlug);
  const regions = useQuery({ queryKey: queryKeys.regions, queryFn: api.dictionaries.regions, staleTime: Infinity });
  const departments = useQuery({ queryKey: queryKeys.tenantAdmin(clientSlug, 'departments'), queryFn: admin.departments });
  const roles = useQuery({ queryKey: queryKeys.tenantAdmin(clientSlug, 'roles'), queryFn: admin.roles });
  const [values, setValues] = useState<OrgMemberPayload>({
    iin: member?.iin ?? preset?.iin ?? '',
    lastName: member?.lastName ?? '',
    firstName: member?.firstName ?? '',
    middleName: member?.middleName ?? '',
    email: member?.email ?? '',
    phone: member ? formatPhone(member.phone) : '',
    region: member?.region ?? '',
    password: '',
    role: member?.role ?? preset?.role ?? 'LEARNER',
    departmentId: member?.departmentId ?? null,
    localRoleIds: member?.localRoleIds ?? [],
  });
  const set = (patch: Partial<OrgMemberPayload>) => setValues((v) => ({ ...v, ...patch }));
  const save = useMutation({
    mutationFn: () => (member ? admin.updateMember(member.id, values) : admin.createMember(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tenant-admin', clientSlug] });
      void qc.invalidateQueries({ queryKey: queryKeys.tenantUsage(clientSlug) });
      message.success(member ? 'Данные пользователя сохранены' : 'Пользователь создан');
      onClose();
    },
  });
  const fe = isApiError(save.error) ? save.error.fieldErrors : {};
  const other = save.isError && !Object.keys(fe).length ? save.error.message : null;
  const text = (key: 'lastName' | 'firstName' | 'middleName' | 'email', label: string, required = true) => (
    <Field label={label} htmlFor={`member-${key}`} required={required} error={fe[key]}>
      <Input id={`member-${key}`} value={values[key]} status={fe[key] ? 'error' : undefined} onChange={(e) => set({ [key]: e.target.value })} />
    </Field>
  );

  return (
    <Modal
      open
      width={640}
      title={member ? `Редактирование: ${member.fullName}` : 'Новый пользователь'}
      okText={member ? 'Сохранить' : 'Создать пользователя'}
      cancelText="Отмена"
      confirmLoading={save.isPending}
      onOk={() => save.mutate()}
      onCancel={onClose}
      destroyOnHidden
    >
      <div className="grid gap-4 pt-2 sm:grid-cols-2" data-testid="member-form">
        <Field label="ИИН" htmlFor="member-iin" required error={fe.iin}>
          <Input
            id="member-iin"
            inputMode="numeric"
            value={values.iin}
            status={fe.iin ? 'error' : undefined}
            onChange={(e) => set({ iin: e.target.value.replace(/\D/g, '').slice(0, 12) })}
          />
        </Field>
        {text('lastName', 'Фамилия')}
        {text('firstName', 'Имя')}
        {text('middleName', 'Отчество', false)}
        {text('email', 'Email')}
        <Field label="Телефон" htmlFor="member-phone" required error={fe.phone}>
          <Input id="member-phone" inputMode="tel" value={values.phone} status={fe.phone ? 'error' : undefined} onChange={(e) => set({ phone: formatPhone(e.target.value) })} />
        </Field>
        <Field label="Область" htmlFor="member-region" required error={fe.region}>
          <Select
            id="member-region"
            aria-label="Область"
            style={{ width: '100%' }}
            showSearch={{ optionFilterProp: 'label' }}
            status={fe.region ? 'error' : undefined}
            value={values.region || undefined}
            options={(regions.data ?? []).map((r) => ({ value: r.name, label: r.name }))}
            onChange={(region) => set({ region })}
          />
        </Field>
        <Field label="Пароль" htmlFor="member-password" required={!member} error={fe.password} hint={member ? 'Оставьте пустым, чтобы не менять' : undefined}>
          <Input.Password id="member-password" autoComplete="new-password" value={values.password} status={fe.password ? 'error' : undefined} onChange={(e) => set({ password: e.target.value })} />
        </Field>
        <Field label="Роль" htmlFor="member-role" required error={fe.role}>
          <Select id="member-role" aria-label="Роль" style={{ width: '100%' }} value={values.role} options={ROLE_OPTIONS} onChange={(role) => set({ role })} />
        </Field>
        <Field label="Отдел" htmlFor="member-department" error={fe.departmentId}>
          <Select
            id="member-department"
            aria-label="Отдел"
            allowClear
            style={{ width: '100%' }}
            placeholder="Без отдела"
            value={values.departmentId ?? undefined}
            options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
            onChange={(v) => set({ departmentId: v ?? null })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Роли компании" htmlFor="member-local-roles">
            <Select
              id="member-local-roles"
              aria-label="Роли компании"
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="Не назначены"
              value={values.localRoleIds}
              options={(roles.data?.roles ?? []).filter((r) => !r.isSystem).map((r) => ({ value: r.id, label: r.nameRu }))}
              onChange={(localRoleIds) => set({ localRoleIds })}
            />
          </Field>
        </div>
        {other && <Alert className="sm:col-span-2" type="error" showIcon title={other} />}
      </div>
    </Modal>
  );
}

/** Раздел «Пользователи»: список, ручное создание, редактирование, деактивация, привязка к отделам и ролям */
export function MembersSection({ clientSlug }: { clientSlug: string }) {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const access = user?.access ?? [];
  const members = useMembers(clientSlug);
  const usage = useQuery({
    queryKey: queryKeys.tenantUsage(clientSlug),
    queryFn: () => api.tenant.usage(clientSlug),
    enabled: access.includes('lms_users.create'),
    retry: false,
  });
  const usersLimit = usage.data?.items.find((i) => i.code === 'USERS_COUNT');
  const limitReached = usersLimit ? usersLimit.used >= usersLimit.limit : false;
  // Переход из «Тренерского состава»: пользователя нет в базе, форма создания открыта с ролью «Тренер»
  const [params, setParams] = useSearchParams();
  const registerTrainer = params.get('register') === 'trainer' && access.includes('lms_users.create');
  const [editing, setEditing] = useState<OrgMember | 'new' | null>(registerTrainer ? 'new' : null);
  const preset = registerTrainer ? { iin: params.get('iin') ?? '', role: 'TRAINER' as const } : undefined;
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch] = useState('');

  const toggle = useMutation({
    mutationFn: (m: OrgMember) => api.tenantAdmin(clientSlug).setMemberActive(m.id, !m.active),
    onSuccess: (m) => {
      void qc.invalidateQueries({ queryKey: ['tenant-admin', clientSlug] });
      void qc.invalidateQueries({ queryKey: queryKeys.tenantUsage(clientSlug) });
      message.success(m.active ? 'Пользователь активирован' : 'Пользователь деактивирован');
    },
    onError: (e) => message.error(e.message),
  });

  const q = search.trim().toLowerCase();
  const visible = useMemo(
    () => (members.data ?? []).filter((m) => !q || [m.fullName, m.iin, m.email].some((v) => v.toLowerCase().includes(q))),
    [members.data, q],
  );

  return (
    <Card
      title="Пользователи"
      extra={
        <span className="flex flex-wrap gap-2">
          {access.includes('lms_users.assign_roles') && (
            <Button onClick={() => setAssigning(true)}>Назначить роль</Button>
          )}
          {access.includes('lms_users.create') && (
            <Button type="primary" icon={<UserPlus size={16} />} disabled={limitReached} onClick={() => setEditing('new')}>
              Создать пользователя
            </Button>
          )}
        </span>
      }
      styles={{ body: { padding: 0 } }}
      data-testid="organization-users"
    >
      {limitReached && (
        <Alert
          className="m-4"
          type="warning"
          showIcon
          title="Достигнут лимит пользователей тарифа"
          description="Чтобы добавить пользователей, перейдите на тариф с большим лимитом или деактивируйте неактивных сотрудников."
        />
      )}
      <div className="p-4">
        <Input
          allowClear
          className="max-w-md"
          aria-label="Поиск пользователя"
          placeholder="Поиск по ФИО, ИИН или Email"
          prefix={<Search size={14} className="text-muted" aria-hidden />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {members.isError ? (
        <div className="p-6">
          <ErrorState error={members.error} onRetry={() => void members.refetch()} />
        </div>
      ) : (
        <Table<OrgMember>
          rowKey="id"
          loading={members.isPending}
          dataSource={visible}
          pagination={{ pageSize: 20, showSizeChanger: false, hideOnSinglePage: true }}
          scroll={{ x: 1040 }}
          onRow={(m) => ({ 'data-testid': `member-${m.iin}` }) as React.HTMLAttributes<HTMLElement>}
          columns={[
            { title: 'ФИО', dataIndex: 'fullName', key: 'fullName' },
            { title: 'ИИН', dataIndex: 'iin', key: 'iin', width: 140, render: (v: string) => <span className="mono">{v}</span> },
            { title: 'Email', dataIndex: 'email', key: 'email' },
            { title: 'Отдел', key: 'department', render: (_, m) => m.departmentName ?? <span className="text-muted">—</span> },
            {
              title: 'Роли',
              key: 'roles',
              render: (_, m) => (
                <span className="flex flex-wrap gap-1">
                  {m.role && <Tag color={m.role === 'ORGANIZATION_ADMIN' ? 'blue' : m.role === 'TRAINER' ? 'purple' : 'default'}>{ROLE_LABEL[m.role]}</Tag>}
                  {m.localRoleNames.map((n) => (
                    <Tag key={n} color="magenta">
                      {n}
                    </Tag>
                  ))}
                </span>
              ),
            },
            {
              title: 'Статус',
              key: 'status',
              width: 110,
              render: (_, m) => (m.active ? <Tag color="green">Активен</Tag> : <Tag>Деактивирован</Tag>),
            },
            {
              title: '',
              key: 'actions',
              width: 96,
              render: (_, m) => (
                <span className="inline-flex gap-1">
                  {access.includes('lms_users.edit') && (
                    <IconButton type="text" label={`Редактировать: ${m.fullName}`} icon={<Pencil size={16} />} onClick={() => setEditing(m)} />
                  )}
                  {access.includes('lms_users.deactivate') && !m.isSelf && (
                    <IconButton
                      type="text"
                      danger={m.active}
                      label={`${m.active ? 'Деактивировать' : 'Активировать'}: ${m.fullName}`}
                      icon={m.active ? <PowerOff size={16} /> : <Power size={16} />}
                      onClick={() =>
                        m.active
                          ? modal.confirm({
                              title: `Деактивировать ${m.fullName}?`,
                              content: 'Пользователь потеряет доступ к кабинету организации. Его можно будет активировать снова.',
                              okText: 'Деактивировать',
                              cancelText: 'Отмена',
                              okButtonProps: { danger: true },
                              onOk: () => toggle.mutate(m),
                            })
                          : toggle.mutate(m)
                      }
                    />
                  )}
                </span>
              ),
            },
          ]}
        />
      )}
      {editing && (
        <MemberModal
          clientSlug={clientSlug}
          member={editing === 'new' ? null : editing}
          preset={editing === 'new' ? preset : undefined}
          onClose={() => {
            setEditing(null);
            if (registerTrainer) setParams({}, { replace: true });
          }}
        />
      )}
      <AssignRoleModal clientSlug={clientSlug} open={assigning} onClose={() => setAssigning(false)} />
    </Card>
  );
}
