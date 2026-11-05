import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Input, Modal, Table, Tag, Typography } from 'antd';
import { Pencil, Search, ShieldPlus, Trash2, UserRoundPlus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { PlatformUser } from '@/api/types';
import { useCurrentUser } from '@/auth/auth';
import { ROLE_LABEL } from '@/features/auth/roles';
import { AssignRoleModal } from '@/features/users/OrganizationUsers';
import { UserFormModal } from '@/features/users/UserFormModal';
import { IconButton } from '@/shared/IconButton';
import { ErrorState } from '@/shared/PageState';
import { useDebouncedValue } from '@/shared/useDebouncedValue';

function PageLayout({ title, extra, search, onSearch, placeholder, children }: {
  title: string;
  extra?: ReactNode;
  search: string;
  onSearch: (v: string) => void;
  placeholder: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex items-center justify-between">
        <Typography.Title level={3} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {extra}
      </div>
      <Card styles={{ body: { padding: 16 } }}>
        <Input
          allowClear
          aria-label={placeholder}
          placeholder={placeholder}
          prefix={<Search size={16} aria-hidden />}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          style={{ width: 360 }}
        />
      </Card>
      {children}
    </div>
  );
}

/** Все пользователи платформы: создание, редактирование, удаление и назначение ролей Администратор / Тренер. */
export function UsersPage() {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const { data: me } = useCurrentUser();
  const [search, setSearch] = useState('');
  const [assignFor, setAssignFor] = useState<PlatformUser | null>(null);
  const [form, setForm] = useState<{ user: PlatformUser | null } | null>(null);
  const [toDelete, setToDelete] = useState<PlatformUser | null>(null);
  const debounced = useDebouncedValue(search.trim(), 300);
  const q = useQuery({ queryKey: queryKeys.platformUsers(debounced), queryFn: () => api.platform.users(debounced) });
  const remove = useMutation({
    mutationFn: (u: PlatformUser) => api.platform.deleteUser(u.id),
    onSuccess: (_, u) => {
      message.success(`Пользователь удалён: ${u.fullName}`);
      void qc.invalidateQueries({ queryKey: queryKeys.platformUsersAll });
      void qc.invalidateQueries({ queryKey: ['organization-users'] });
      setToDelete(null);
    },
    onError: (e) => message.error(e.message),
  });

  return (
    <PageLayout
      title="Пользователи"
      search={search}
      onSearch={setSearch}
      placeholder="Поиск по ФИО, ИИН или email"
      extra={
        <Button type="primary" icon={<UserRoundPlus size={16} />} onClick={() => setForm({ user: null })}>
          Создать пользователя
        </Button>
      }
    >
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          <Table<PlatformUser>
            rowKey="id"
            loading={q.isPending}
            dataSource={q.data}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            scroll={{ x: 900 }}
            columns={[
              { title: 'ФИО', dataIndex: 'fullName', key: 'fullName' },
              { title: 'ИИН', dataIndex: 'iin', key: 'iin', width: 150, render: (v: string) => <span className="mono">{v}</span> },
              { title: 'Email', dataIndex: 'email', key: 'email' },
              {
                title: 'Роли',
                key: 'roles',
                render: (_, u) => (
                  <span className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <Tag
                        key={`${r.role}:${r.clientSlug ?? ''}`}
                        color={r.role === 'SUPERADMIN' ? 'red' : r.role === 'ORGANIZATION_ADMIN' ? 'blue' : r.role === 'TRAINER' ? 'purple' : 'default'}
                      >
                        {ROLE_LABEL[r.role]}
                        {r.organizationName ? ` · ${r.organizationName}` : ''}
                      </Tag>
                    ))}
                  </span>
                ),
              },
              {
                title: '',
                key: 'actions',
                width: 132,
                align: 'center',
                render: (_, u) => (
                  <span className="flex justify-center gap-1">
                    <IconButton
                      type="text"
                      label={`Редактировать: ${u.fullName}`}
                      icon={<Pencil size={16} />}
                      onClick={() => setForm({ user: u })}
                    />
                    <IconButton
                      type="text"
                      label={`Назначить роль: ${u.fullName}`}
                      icon={<ShieldPlus size={16} />}
                      onClick={() => setAssignFor(u)}
                    />
                    <IconButton
                      type="text"
                      danger
                      label={u.id === me?.id ? 'Нельзя удалить собственную учётную запись' : `Удалить: ${u.fullName}`}
                      icon={<Trash2 size={16} />}
                      disabled={u.id === me?.id}
                      onClick={() => setToDelete(u)}
                    />
                  </span>
                ),
              },
            ]}
          />
        </Card>
      )}
      {assignFor && (
        <AssignRoleModal key={assignFor.id} open user={assignFor} onClose={() => setAssignFor(null)} />
      )}
      {form && <UserFormModal key={form.user?.id ?? 'new'} user={form.user} onClose={() => setForm(null)} />}
      <Modal
        open={Boolean(toDelete)}
        title="Удалить пользователя?"
        okText="Удалить"
        cancelText="Отмена"
        okButtonProps={{ danger: true }}
        confirmLoading={remove.isPending}
        onOk={() => toDelete && remove.mutate(toDelete)}
        onCancel={() => setToDelete(null)}
      >
        <Typography.Paragraph>
          Учётная запись «{toDelete?.fullName}» (ИИН <span className="mono">{toDelete?.iin}</span>) и все её роли будут
          удалены. Пользователь больше не сможет войти в систему.
        </Typography.Paragraph>
      </Modal>
    </PageLayout>
  );
}
