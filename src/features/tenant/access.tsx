import { useQueryClient } from '@tanstack/react-query';
import { App, Modal, Skeleton } from 'antd';
import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { queryKeys } from '@/api/queryKeys';
import type { CurrentUser, TenantAccess, TenantModule } from '@/api/types';
import { useCurrentUser } from '@/auth/auth';
import { useTenantAccess, useTenantModules } from './queries';

export const ORGANIZATION_MANAGE = 'organization.manage';

/**
 * Функция доступна только при одновременном выполнении условий:
 * право роли пользователя И модуль включён в конфигурации организации (раздел 19.3).
 * Сервер повторяет эту проверку для каждого запроса.
 */
export function canUseFeature(
  user: Pick<CurrentUser, 'permissions'> | null | undefined,
  access: Pick<TenantAccess, 'enabledModules' | 'subscriptionStatus'> | null | undefined,
  module: Pick<TenantModule, 'code' | 'requiredPermission'>,
): boolean {
  if (!user || !access || access.subscriptionStatus !== 'ACTIVE') return false;
  return user.permissions.includes(module.requiredPermission) && access.enabledModules.includes(module.code);
}

export const canManageOrganization = (user: Pick<CurrentUser, 'permissions'> | null | undefined) =>
  Boolean(user?.permissions.includes(ORGANIZATION_MANAGE));

/** Всё, что нужно для решения о доступе: пользователь, конфигурация организации, справочник модулей. */
export function useTenantContext() {
  const { clientSlug = '' } = useParams();
  const user = useCurrentUser();
  const access = useTenantAccess(clientSlug);
  const modules = useTenantModules(clientSlug, access.data?.subscriptionStatus === 'ACTIVE');
  const available = (modules.data ?? []).filter((m) => canUseFeature(user.data, access.data, m));
  return {
    clientSlug,
    user: user.data ?? null,
    access: access.data,
    /** Модули, доступные одновременно организации и роли */
    availableModules: available,
    isAdmin: canManageOrganization(user.data),
    isLoading: user.isPending || access.isPending || (access.data?.subscriptionStatus === 'ACTIVE' && modules.isPending),
  };
}

export function useFeature(code: string): { enabled: boolean; isLoading: boolean } {
  const ctx = useTenantContext();
  return { enabled: ctx.availableModules.some((m) => m.code === code), isLoading: ctx.isLoading };
}

export const MODULE_REVOKED_TEXT = 'Доступ к модулю отключён администратором Sanastra';

/** Модуль отключили, пока он был открыт: закрыть окна, отменить его запросы, уведомить и уйти на dashboard. */
function RevokedRedirect({ code }: { code: string }) {
  const { clientSlug = '' } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { message } = App.useApp();
  useEffect(() => {
    Modal.destroyAll();
    const key = queryKeys.tenantModuleData(clientSlug, code);
    void qc.cancelQueries({ queryKey: key });
    qc.removeQueries({ queryKey: key }); // повторять запрещённый запрос не нужно
    message.warning({ key: 'module-revoked', content: MODULE_REVOKED_TEXT });
    navigate(`/${clientSlug}/dashboard`, { replace: true });
  }, [clientSlug, code, message, navigate, qc]);
  return null;
}

/** Route guard модуля. До загрузки конфигурации показывает skeleton — запрещённый контент не мелькает. */
export function FeatureGuard({ code, children }: { code: string; children: ReactNode }) {
  const { clientSlug = '' } = useParams();
  const { enabled, isLoading } = useFeature(code);
  const [wasEnabled, setWasEnabled] = useState(false);
  if (enabled && !wasEnabled) setWasEnabled(true);

  if (isLoading) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (enabled) return <>{children}</>;
  if (wasEnabled) return <RevokedRedirect code={code} />;
  return <Navigate to={`/${clientSlug}/feature-unavailable`} replace />;
}

/** Страницы управления организацией — только для администратора организации. */
export function RequireOrganizationAdmin({ children }: { children: ReactNode }) {
  const { clientSlug = '' } = useParams();
  const { data: user, isPending } = useCurrentUser();
  if (isPending) return <Skeleton active />;
  if (!canManageOrganization(user)) return <Navigate to={`/${clientSlug}/feature-unavailable`} replace />;
  return <>{children}</>;
}
