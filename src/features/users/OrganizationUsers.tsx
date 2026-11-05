import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Input, Modal, Select, Table, Tag } from 'antd';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { AssignableRole, OrganizationUser } from '@/api/types';
import { ROLE_LABEL } from '@/features/auth/roles';
import { Field } from '@/shared/FormField';
import { ErrorState } from '@/shared/PageState';

const ASSIGNABLE: { value: AssignableRole; label: string }[] = [
  { value: 'ORGANIZATION_ADMIN', label: ROLE_LABEL.ORGANIZATION_ADMIN },
  { value: 'TRAINER', label: ROLE_LABEL.TRAINER },
];

/**
 * Назначение дополнительной роли зарегистрированному пользователю (по ИИН).
 * Без `clientSlug` (раздел суперадмина) организация выбирается в форме.
 */
export function AssignRoleModal({ clientSlug, open, onClose }: { clientSlug?: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [iin, setIin] = useState('');
  const [role, setRole] = useState<AssignableRole>();
  const [orgSlug, setOrgSlug] = useState<string>();
  const slug = clientSlug ?? orgSlug;
  const orgs = useQuery({
    queryKey: queryKeys.organizations({ search: '', status: '', tariffPlanId: '', page: 1, pageSize: 100 }),
    queryFn: () => api.organizations.list({ search: '', status: '', tariffPlanId: '', page: 1, pageSize: 100 }),
    enabled: open && !clientSlug,
  });
  const assign = useMutation({
    mutationFn: () => api.organizationUsers.assignRole(slug!, iin, role!),
    onSuccess: (u) => {
      message.success(`Роль назначена: ${u.fullName}`);
      void qc.invalidateQueries({ queryKey: queryKeys.organizationUsers(slug!) });
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
      title="Назначить роль"
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
            placeholder="Выберите роль"
            options={ASSIGNABLE}
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

/** Раздел «Пользователи» организации: список и назначение ролей Администратор / Тренер. */
export function OrganizationUsers({ clientSlug }: { clientSlug: string }) {
  const [open, setOpen] = useState(false);
  const users = useQuery({
    queryKey: queryKeys.organizationUsers(clientSlug),
    queryFn: () => api.organizationUsers.list(clientSlug),
  });

  return (
    <Card
      title="Пользователи"
      extra={
        <Button type="primary" icon={<UserPlus size={16} />} onClick={() => setOpen(true)}>
          Назначить роль
        </Button>
      }
      styles={{ body: { padding: 0 } }}
      data-testid="organization-users"
    >
      {users.isError ? (
        <div className="p-6">
          <ErrorState error={users.error} onRetry={() => void users.refetch()} />
        </div>
      ) : (
        <Table<OrganizationUser>
          rowKey="id"
          loading={users.isPending}
          dataSource={users.data}
          pagination={false}
          scroll={{ x: 640 }}
          columns={[
            { title: 'ФИО', dataIndex: 'fullName', key: 'fullName' },
            { title: 'ИИН', dataIndex: 'iin', key: 'iin', render: (v: string) => <span className="mono">{v}</span> },
            { title: 'Email', dataIndex: 'email', key: 'email' },
            {
              title: 'Роли',
              key: 'roles',
              render: (_, u) => (
                <span className="flex flex-wrap gap-1">
                  {u.roles.map((r) => (
                    <Tag key={r} color={r === 'ORGANIZATION_ADMIN' ? 'blue' : r === 'TRAINER' ? 'purple' : 'default'}>
                      {ROLE_LABEL[r]}
                    </Tag>
                  ))}
                </span>
              ),
            },
          ]}
        />
      )}
      <AssignRoleModal clientSlug={clientSlug} open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}
