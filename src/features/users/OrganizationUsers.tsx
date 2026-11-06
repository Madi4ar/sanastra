import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Input, Modal, Select } from 'antd';
import { useState } from 'react';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { AssignableRole } from '@/api/types';
import { Field } from '@/shared/FormField';

/**
 * Назначение дополнительной роли зарегистрированному пользователю (по ИИН).
 * Без `clientSlug` (раздел суперадмина) организация выбирается в форме.
 */
export function AssignRoleModal({
  clientSlug,
  open,
  onClose,
  user,
}: {
  clientSlug?: string;
  open: boolean;
  onClose: () => void;
  /** Пользователь выбран заранее (действие в строке таблицы) — ИИН подставляется и не редактируется */
  user?: { iin: string; fullName: string };
}) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [iin, setIin] = useState(user?.iin ?? '');
  const [role, setRole] = useState<AssignableRole>();
  const [orgSlug, setOrgSlug] = useState<string>();
  const slug = clientSlug ?? orgSlug;
  const orgs = useQuery({
    queryKey: queryKeys.organizations({ search: '', status: '', tariffPlanId: '', page: 1, pageSize: 100 }),
    queryFn: () => api.organizations.list({ search: '', status: '', tariffPlanId: '', page: 1, pageSize: 100 }),
    enabled: open && !clientSlug,
  });
  // Системные роли и кастомные глобальные роли, созданные суперадминистратором
  const assignable = useQuery({
    queryKey: queryKeys.assignableRoles(slug ?? ''),
    queryFn: () => api.organizationUsers.assignableRoles(slug!),
    enabled: open && Boolean(slug),
  });
  const assign = useMutation({
    mutationFn: () => api.organizationUsers.assignRole(slug!, iin, role!),
    onSuccess: (u) => {
      message.success(`Роль назначена: ${u.fullName}`);
      void qc.invalidateQueries({ queryKey: queryKeys.organizationUsers(slug!) });
      void qc.invalidateQueries({ queryKey: ['tenant-admin', slug!] });
      void qc.invalidateQueries({ queryKey: queryKeys.platformUsersAll });
      close();
    },
  });
  const fe = isApiError(assign.error) ? assign.error.fieldErrors : {};
  const other = assign.isError && !Object.keys(fe).length ? assign.error.message : null;

  const close = () => {
    setIin('');
    setRole(undefined);
    setOrgSlug(undefined);
    assign.reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      title={user ? `Назначить роль: ${user.fullName}` : 'Назначить роль'}
      okText="Назначить"
      cancelText="Отмена"
      confirmLoading={assign.isPending}
      okButtonProps={{ disabled: iin.length !== 12 || !role || !slug }}
      onOk={() => assign.mutate()}
      onCancel={close}
      destroyOnHidden
    >
      <div className="flex flex-col gap-4 pt-2">
        <Field label="ИИН пользователя" htmlFor="assign-iin" required error={fe.iin}>
          <Input
            id="assign-iin"
            inputMode="numeric"
            placeholder="12 цифр"
            value={iin}
            disabled={Boolean(user)}
            status={fe.iin ? 'error' : undefined}
            onChange={(e) => {
              setIin(e.target.value.replace(/\D/g, '').slice(0, 12));
              assign.reset();
            }}
          />
        </Field>
        {!clientSlug && (
          <Field label="Организация" htmlFor="assign-org" required>
            <Select
              id="assign-org"
              className="w-full"
              placeholder="Выберите организацию"
              showSearch={{ optionFilterProp: 'label' }}
              loading={orgs.isPending}
              options={(orgs.data?.items ?? []).map((o) => ({ value: o.clientSlug, label: o.name }))}
              value={orgSlug}
              onChange={(v) => {
                setOrgSlug(v);
                assign.reset();
              }}
            />
          </Field>
        )}
        <Field label="Роль" htmlFor="assign-role" required error={fe.role}>
          <Select
            id="assign-role"
            className="w-full"
            placeholder={slug ? 'Выберите роль' : 'Сначала выберите организацию'}
            disabled={!slug}
            loading={assignable.isPending && Boolean(slug)}
            options={assignable.data ?? []}
            value={role}
            status={fe.role ? 'error' : undefined}
            onChange={(v) => {
              setRole(v);
              assign.reset();
            }}
          />
        </Field>
        {other && <p className="m-0 text-sm text-error">{other}</p>}
      </div>
    </Modal>
  );
}
