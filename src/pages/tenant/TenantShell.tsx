import { useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { useTenantRealtime, invalidateTenant } from '@/features/realtime/useTenantRealtime';
import { useCabinet } from '@/features/tenant/cabinet';
import { useTenantAccess } from '@/features/tenant/queries';
import { noticeStore } from '@/shared/notices';

export const CONFIG_UPDATED_TEXT = 'Настройки подписки обновлены';

/**
 * Tenant context вкладки: одно SSE-соединение (закрывается при уходе/выходе)
 * и единая реакция на рост configVersion — неважно, пришло изменение через SSE, polling или focus.
 */
export function TenantShell() {
  const { clientSlug } = useCabinet();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const access = useTenantAccess(clientSlug);
  useTenantRealtime(clientSlug);

  const version = access.data?.configVersion;
  const status = access.data?.subscriptionStatus;
  const prevVersion = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (version === undefined) return;
    const prev = prevVersion.current;
    prevVersion.current = version;
    if (prev === undefined || version <= prev) return;
    // Изменение могло прийти через polling/focus без SSE-события — обновляем зависимые данные
    // (сам access уже свежий — повторно не запрашиваем)
    invalidateTenant(qc, clientSlug, 'all', { access: false });
    if (status === 'ACTIVE') {
      // Один toast на серию событий (ключ объединяет уведомления)
      message.info({ key: 'config-updated', content: CONFIG_UPDATED_TEXT });
      noticeStore.push(CONFIG_UPDATED_TEXT);
    }
  }, [version, status, clientSlug, qc, message]);

  const denied = access.error instanceof ApiError && access.error.code === 'FORBIDDEN';
  useEffect(() => {
    if (denied) void qc.invalidateQueries({ queryKey: queryKeys.me });
  }, [denied, qc]);

  useEffect(() => () => noticeStore.clear(), [clientSlug]);

  return <Outlet />;
}
