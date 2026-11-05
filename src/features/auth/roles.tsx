import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Button, Dropdown, type MenuProps } from 'antd';
import { Check, ChevronDown, Repeat } from 'lucide-react';
import { useNavigate } from 'react-router';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { CurrentUser, Role, RoleAssignment } from '@/api/types';
import { homeFor, useCurrentUser } from '@/auth/auth';

export const ROLE_LABEL: Record<Role, string> = {
  SUPERADMIN: 'Суперадминистратор',
  ORGANIZATION_ADMIN: 'Администратор организации',
  TRAINER: 'Тренер',
  LEARNER: 'Слушатель',
};

export const assignmentLabel = (r: RoleAssignment) =>
  r.organizationName ? `${ROLE_LABEL[r.role]} · ${r.organizationName}` : ROLE_LABEL[r.role];

const isActive = (user: CurrentUser, r: RoleAssignment) =>
  user.role === r.role && (user.clientSlug ?? null) === (r.clientSlug ?? null);

/** Переключение рабочего контекста (роли) — пункты для меню профиля в шапке. */
export function useRoleSwitchItems(): MenuProps['items'] {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const switchRole = useMutation({
    mutationFn: api.auth.switchRole,
    onSuccess: (next) => {
      qc.clear();
      qc.setQueryData(queryKeys.me, next);
      navigate(homeFor(next), { replace: true });
    },
    onError: (e) => message.error(isApiError(e) ? e.message : 'Не удалось сменить роль'),
  });
  if (!user || user.roles.length < 2) return [];
  return [
    {
      type: 'group',
      key: 'roles',
      label: 'Сменить роль',
      children: user.roles.map((r) => {
        const active = isActive(user, r);
        return {
          key: `role:${r.role}:${r.clientSlug ?? ''}`,
          icon: active ? <Check size={16} /> : <span className="inline-block w-4" />,
          label: assignmentLabel(r),
          disabled: active || switchRole.isPending,
          onClick: () => switchRole.mutate({ role: r.role, clientSlug: r.clientSlug }),
        };
      }),
    },
  ];
}

/** Отдельная кнопка смены роли — для шапок без меню профиля. */
export function RoleSwitcher() {
  const items = useRoleSwitchItems();
  if (!items?.length) return null;
  return (
    <Dropdown trigger={['click']} placement="bottomRight" menu={{ items }}>
      <Button icon={<Repeat size={16} />} iconPlacement="start">
        Сменить роль <ChevronDown size={14} aria-hidden />
      </Button>
    </Dropdown>
  );
}
