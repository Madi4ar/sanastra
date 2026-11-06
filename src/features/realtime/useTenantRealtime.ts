import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryKeys } from '@/api/queryKeys';
import type { ChangedArea, TenantEvent } from '@/api/types';
import { REALTIME } from './config';
import { realtimeStatus } from './realtimeStatus';
import { TenantEventStream } from './TenantEventStream';

/** Инвалидация по набору изменившихся областей (раздел 26.4). */
export function invalidateTenant(
  qc: QueryClient,
  clientSlug: string,
  changed: Iterable<ChangedArea> | 'all',
  { access = true }: { access?: boolean } = {},
) {
  const areas = new Set(changed === 'all' ? (['tariff', 'subscription', 'modules', 'limits', 'permissions'] as ChangedArea[]) : changed);
  // Итоговый доступ = матрица роли ∩ тариф: при изменении любой из частей пересчитываются профиль и содержимое курсов
  if (areas.has('permissions') || areas.has('modules') || areas.has('tariff')) {
    void qc.invalidateQueries({ queryKey: queryKeys.me });
    void qc.invalidateQueries({ queryKey: queryKeys.tenantModules(clientSlug) });
    void qc.invalidateQueries({ queryKey: ['course-content', clientSlug] });
  }
  if (access) void qc.invalidateQueries({ queryKey: queryKeys.tenantAccess(clientSlug) });
  if (areas.has('tariff') || areas.has('subscription'))
    void qc.invalidateQueries({ queryKey: queryKeys.subscriptionSummary(clientSlug) });
  if (areas.has('modules') || areas.has('tariff')) void qc.invalidateQueries({ queryKey: queryKeys.tenantModules(clientSlug) });
  if (areas.has('limits') || areas.has('tariff')) {
    void qc.invalidateQueries({ queryKey: queryKeys.tenantUsage(clientSlug) });
    void qc.invalidateQueries({ queryKey: ['tenant-module', clientSlug] });
  }
}

/** События, которые применяются немедленно, без debounce. */
const URGENT: TenantEvent['type'][] = ['subscription.blocked', 'subscription.expired', 'module.disabled'];

/**
 * Подписка вкладки на события tenant. Серия событий объединяется (debounce),
 * критические (блокировка, отключение модуля) применяются сразу.
 */
export function useTenantRealtime(clientSlug: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!clientSlug) return;
    const pending = new Set<ChangedArea>();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      clearTimeout(timer);
      timer = undefined;
      invalidateTenant(qc, clientSlug, pending);
      pending.clear();
    };

    const stream = new TenantEventStream({
      url: `/api/tenant/events?clientSlug=${encodeURIComponent(clientSlug)}`,
      onEvent: (event) => {
        event.changed.forEach((c) => pending.add(c));
        if (URGENT.includes(event.type)) {
          flush();
          return;
        }
        clearTimeout(timer);
        timer = setTimeout(flush, REALTIME.debounceMs);
      },
      onReconnected: () => invalidateTenant(qc, clientSlug, 'all'),
      onStatus: realtimeStatus.set,
    });
    stream.start();

    return () => {
      clearTimeout(timer);
      stream.close();
    };
  }, [clientSlug, qc]);
}
