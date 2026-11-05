import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Avatar, Button, Card, Descriptions, Input, List, Modal, Result, Skeleton } from 'antd';
import { ArrowLeft, Ban, LogOut, Plus, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { tokens } from '@/app/theme';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { CurrentUser } from '@/api/types';
import { useLogout } from '@/auth/auth';
import { ROLE_LABEL } from '@/features/auth/roles';
import { formatPhone } from '@/features/auth/validation';
import { FeatureGuard, useTenantContext } from '@/features/tenant/access';
import { useCabinet } from '@/features/tenant/cabinet';
import { CoursesView } from '@/features/tenant/content/CoursesView';
import { OrganizationUsers } from '@/features/users/OrganizationUsers';
import { WebinarsView } from '@/features/tenant/content/WebinarsView';
import { ErrorState } from '@/shared/PageState';
import { PageHeader } from './PageHeader';

/** Карточка профиля: данные регистрации и активная роль. */
export function ProfileCard({ user, organizationName }: { user: CurrentUser; organizationName?: string }) {
  const logout = useLogout();
  return (
    <Card>
      <div className="mb-6 flex items-center gap-4">
        <Avatar size={56} icon={<UserRound size={24} />} style={{ background: tokens.colorPrimary }} />
        <div className="min-w-0">
          <div className="text-lg font-semibold">{user.fullName}</div>
          <div className="text-muted">{ROLE_LABEL[user.role]}</div>
        </div>
      </div>
      <Descriptions
        column={1}
        items={[
          { key: 'iin', label: 'ИИН', children: user.iin },
          { key: 'region', label: 'Область', children: user.region },
          { key: 'phone', label: 'Телефон', children: formatPhone(user.phone) },
          { key: 'email', label: 'Email', children: user.email },
          ...(organizationName ? [{ key: 'org', label: 'Организация', children: organizationName }] : []),
        ]}
      />
      <Button className="mt-6" icon={<LogOut size={16} />} onClick={() => logout.mutate()}>
        Выйти
      </Button>
    </Card>
  );
}

export function ProfilePage() {
  const { user, access } = useTenantContext();
  if (!user) return null;
  return (
    <>
      <PageHeader title="Профиль" />
      <ProfileCard user={user} organizationName={access?.organizationName} />
    </>
  );
}

export function FeatureUnavailablePage() {
  const { base } = useCabinet();
  const navigate = useNavigate();
  return (
    <Card>
      <Result
        icon={<Ban size={56} className="mx-auto text-muted" aria-hidden />}
        title="Функция недоступна"
        subTitle="Эта возможность не входит в конфигурацию вашей организации или недоступна для вашей роли."
        extra={
          <Button type="primary" icon={<ArrowLeft size={16} />} onClick={() => navigate(base, { replace: true })}>
            На главную
          </Button>
        }
      />
    </Card>
  );
}

function ModuleContent({ code }: { code: string }) {
  const { clientSlug } = useTenantContext();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const key = queryKeys.tenantModuleData(clientSlug, code);
  const q = useQuery({ queryKey: key, queryFn: () => api.tenant.moduleData(clientSlug, code), retry: false });

  const create = useMutation({
    mutationFn: () => api.tenant.createInModule(clientSlug, code),
    onSuccess: () => {
      message.success('Создано');
      setCreateOpen(false);
      setTitle('');
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: queryKeys.tenantUsage(clientSlug) });
    },
    onError: (e) => message.error(isApiError(e) ? e.message : 'Не удалось выполнить действие'),
  });

  if (q.isPending) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (q.data.kind === 'courses') return <CoursesView data={q.data} clientSlug={clientSlug} />;
  if (q.data.kind === 'webinars') return <WebinarsView data={q.data} clientSlug={clientSlug} />;
  const action = q.data.create;

  return (
    <>
      <PageHeader
        title={q.data.title}
        extra={
          action && (
            <Button type="primary" icon={<Plus size={16} />} disabled={!action.available} onClick={() => setCreateOpen(true)}>
              {action.label}
            </Button>
          )
        }
      />
      {action && !action.available && (
        <Alert
          className="mb-6"
          type="warning"
          showIcon
          title="Достигнут лимит тарифа"
          description="Создание новых записей недоступно. Обратитесь к администратору организации."
        />
      )}
      <Card>
        <List dataSource={q.data.items} renderItem={(i) => <List.Item>{i}</List.Item>} />
      </Card>
      <Modal
        open={createOpen}
        title={action?.label}
        okText="Создать"
        cancelText="Отмена"
        confirmLoading={create.isPending}
        okButtonProps={{ disabled: !title.trim() }}
        onOk={() => create.mutate()}
        onCancel={() => setCreateOpen(false)}
        destroyOnHidden
      >
        <Input aria-label="Название" placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Modal>
    </>
  );
}

/** Модуль «Пользователи» — раздел пользователей организации с назначением ролей. */
function UsersModule() {
  const { clientSlug } = useCabinet();
  return (
    <>
      <PageHeader title="Пользователи" />
      <OrganizationUsers clientSlug={clientSlug} />
    </>
  );
}

export function ModulePage() {
  const { moduleCode = '' } = useParams();
  return (
    <FeatureGuard code={moduleCode}>
      {moduleCode === 'USERS' ? <UsersModule /> : <ModuleContent code={moduleCode} />}
    </FeatureGuard>
  );
}
