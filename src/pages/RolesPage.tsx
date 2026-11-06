import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Input, Modal, Table, Tabs, Tag, Tooltip, Typography } from 'antd';
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { GlobalRole, GlobalRolePayload } from '@/api/types';
import { Field } from '@/shared/FormField';
import { formatDateTime } from '@/shared/format';
import { IconButton } from '@/shared/IconButton';
import { ErrorState } from '@/shared/PageState';
import { modulesOf } from '@/shared/access';
import { LocalRolesMonitor } from './LocalRolesMonitor';

export const ROLE_CODE_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

export function useGlobalRoles() {
  return useQuery({ queryKey: queryKeys.globalRoles, queryFn: api.roles.list });
}

/** Раздел «Роли и доступы»: глобальные роли платформы и мониторинг пользовательских ролей компаний */
export function RolesPage() {
  const roles = useGlobalRoles();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [creating, setCreating] = useState(false);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'local' ? 'local' : 'global';

  const remove = useMutation({
    mutationFn: (r: GlobalRole) => api.roles.remove(r.id),
    onSuccess: (_, r) => {
      void qc.invalidateQueries({ queryKey: queryKeys.globalRoles });
      message.success(`Роль «${r.name}» удалена`);
    },
    onError: (e) => {
      // Блокирующая ошибка: к роли привязаны пользователи
      if (isApiError(e) && e.status === 409)
        modal.error({
          title: 'Роль нельзя удалить',
          content: (
            <div className="flex flex-col gap-2">
              <span>{e.message}</span>
              {/* Окно рендерится вне роутера — переход через navigate */}
              <Button
                type="link"
                className="self-start px-0"
                onClick={() => {
                  Modal.destroyAll();
                  navigate('/superadmin/users');
                }}
              >
                Переназначить пользователей
              </Button>
            </div>
          ),
          okText: 'Понятно',
        });
      else message.error(e.message);
    },
  });

  const confirmRemove = (r: GlobalRole) =>
    modal.confirm({
      title: `Удалить роль «${r.name}»?`,
      content: 'Роль и её матрица доступов будут удалены. Удалить можно только роль без привязанных пользователей.',
      okText: 'Удалить',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      onOk: () => remove.mutateAsync(r).catch(() => undefined),
    });

  const globalRoles = roles.isError ? (
        <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />
      ) : (
        <Card
          title="Глобальные роли"
          extra={
            <Button type="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              Создать глобальную роль
            </Button>
          }
          styles={{ body: { padding: 0 } }}
        >
          <Table<GlobalRole>
            rowKey="id"
            loading={roles.isPending}
            dataSource={roles.data}
            pagination={false}
            scroll={{ x: 900 }}
            onRow={(r) => ({ 'data-testid': `role-row-${r.code}` }) as React.HTMLAttributes<HTMLElement>}
            columns={[
              {
                title: 'Роль',
                key: 'name',
                render: (_, r) => (
                  <div>
                    <Link to={`/superadmin/roles/${r.id}`} className="font-semibold">
                      {r.name}
                    </Link>
                    {r.description && <div className="text-xs text-muted">{r.description}</div>}
                  </div>
                ),
              },
              {
                title: 'Системный код',
                dataIndex: 'code',
                key: 'code',
                width: 200,
                render: (v: string) => <span className="mono text-xs">{v}</span>,
              },
              {
                title: 'Тип',
                key: 'type',
                width: 150,
                render: (_, r) =>
                  r.isSystem ? (
                    <Tag icon={<Lock size={12} className="mr-1 inline" aria-hidden />}>Системная</Tag>
                  ) : (
                    <Tag color="purple">Кастомная</Tag>
                  ),
              },
              {
                title: 'Модулей в матрице',
                key: 'modules',
                width: 160,
                render: (_, r) => (
                  <span>
                    {modulesOf(r.matrix).length} <span className="text-xs text-muted">· опций {r.matrix.length}</span>
                  </span>
                ),
              },
              { title: 'Пользователей', dataIndex: 'usersCount', key: 'users', width: 130 },
              {
                title: 'Изменена',
                key: 'updatedAt',
                width: 160,
                render: (_, r) => <span className="text-sm">{formatDateTime(r.updatedAt)}</span>,
              },
              {
                title: '',
                key: 'actions',
                width: 96,
                align: 'center',
                render: (_, r) => (
                  <span className="inline-flex gap-1">
                    <IconButton
                      type="text"
                      label={`Редактировать роль «${r.name}»`}
                      icon={<Pencil size={16} />}
                      onClick={() => navigate(`/superadmin/roles/${r.id}`)}
                    />
                    <IconButton
                      type="text"
                      danger
                      label={r.isSystem ? 'Системная роль защищена от удаления' : `Удалить роль «${r.name}»`}
                      icon={<Trash2 size={16} />}
                      disabled={r.isSystem}
                      onClick={() => confirmRemove(r)}
                    />
                  </span>
                ),
              },
            ]}
          />
        </Card>
      );

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Роли и доступы
        </Typography.Title>
        <Typography.Text type="secondary">
          Глобальные роли платформы и их матрицы доступов, а также роли и отделы, которые компании создают у себя.
          Итоговый доступ пользователя — пересечение матрицы роли с модулями тарифа его организации.
        </Typography.Text>
      </div>

      <Tabs
        activeKey={tab}
        onChange={(k) => setParams(k === 'local' ? { tab: 'local' } : {}, { replace: true })}
        items={[
          {
            key: 'global',
            label: 'Глобальные роли',
            children: globalRoles,
          },
          { key: 'local', label: 'Пользовательские роли компаний', children: <LocalRolesMonitor /> },
        ]}
      />

      {creating && (
        <RoleFormModal
          onClose={() => setCreating(false)}
          onSaved={(r) => {
            setCreating(false);
            navigate(`/superadmin/roles/${r.id}?tab=matrix`);
          }}
        />
      )}
    </div>
  );
}

/** Создание глобальной роли (или правка названия и описания существующей) */
export function RoleFormModal({
  role,
  onClose,
  onSaved,
}: {
  role?: GlobalRole;
  onClose: () => void;
  onSaved: (r: GlobalRole) => void;
}) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [values, setValues] = useState<GlobalRolePayload>({
    name: role?.name ?? '',
    code: role?.code ?? '',
    description: role?.description ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (patch: Partial<GlobalRolePayload>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  const localErrors: Record<string, string> = {};
  const name = values.name.trim();
  if (name.length < 2 || name.length > 60) localErrors.name = 'Название — от 2 до 60 символов';
  if (!role && !ROLE_CODE_PATTERN.test(values.code)) localErrors.code = 'Латиница в нижнем регистре, цифры и «_», от 2 до 40 символов';

  const save = useMutation({
    mutationFn: () => (role ? api.roles.update(role.id, values) : api.roles.create(values)),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: queryKeys.globalRoles });
      message.success(role ? 'Роль сохранена' : `Роль «${r.name}» создана с пустой матрицей прав`);
      onSaved(r);
    },
    onError: (e) => {
      if (isApiError(e) && Object.keys(e.fieldErrors).length) setErrors(e.fieldErrors);
      else message.error(e.message);
    },
  });
  const [tried, setTried] = useState(false);
  const shown = { ...(tried ? localErrors : {}), ...errors };
  const submit = () => {
    setTried(true);
    if (!Object.keys(localErrors).length) save.mutate();
  };

  return (
    <Modal
      open
      title={role ? 'Редактирование роли' : 'Новая глобальная роль'}
      okText={role ? 'Сохранить' : 'Создать роль'}
      cancelText="Отмена"
      confirmLoading={save.isPending}
      onOk={submit}
      onCancel={onClose}
      destroyOnHidden
    >
      <form
        className="flex flex-col gap-4 pt-2"
        noValidate
        aria-label={role ? 'Редактирование роли' : 'Новая глобальная роль'}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Название роли" htmlFor="role-name" required error={shown.name}>
          <Input
            id="role-name"
            autoFocus
            maxLength={60}
            placeholder="Например, «Старший методист»"
            value={values.name}
            status={shown.name ? 'error' : undefined}
            onChange={(e) => set({ name: e.target.value })}
          />
        </Field>
        <Field
          label="Системный код / Slug"
          htmlFor="role-code"
          required={!role}
          error={shown.code}
          hint={role ? 'Уникальный идентификатор роли не изменяется.' : 'Уникальный идентификатор: латиница, цифры и «_».'}
        >
          <Input
            id="role-code"
            className="mono"
            maxLength={40}
            placeholder="senior_methodist"
            value={values.code}
            disabled={Boolean(role)}
            status={shown.code ? 'error' : undefined}
            onChange={(e) => set({ code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
          />
        </Field>
        <Field label="Описание" htmlFor="role-description" error={shown.description}>
          <Input.TextArea
            id="role-description"
            rows={3}
            maxLength={500}
            showCount
            value={values.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </Field>
        {!role && <p className="m-0 text-xs text-muted">Роль создаётся с пустой матрицей прав — все опции выключены (OFF).</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export function RoleSystemHint({ role }: { role: GlobalRole }) {
  if (!role.isSystem) return null;
  return (
    <Tooltip title="Базовая системная роль (is_system = true) защищена от удаления на уровне ядра системы">
      <Tag icon={<Lock size={12} className="mr-1 inline" aria-hidden />}>Системная роль</Tag>
    </Tooltip>
  );
}
