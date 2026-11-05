import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import { REALTIME } from '@/features/realtime/config';
import { useRealtimeStatus } from '@/features/realtime/realtimeStatus';

/**
 * Эффективная конфигурация организации. Основной канал обновлений — SSE (инвалидация);
 * при длительной недоступности SSE включается polling, при фокусе вкладки — сверка configVersion.
 */
export function useTenantAccess(clientSlug: string | undefined) {
  const status = useRealtimeStatus();
  return useQuery({
    queryKey: queryKeys.tenantAccess(clientSlug ?? ''),
    queryFn: () => api.tenant.access(clientSlug!),
    enabled: Boolean(clientSlug),
    // Свежесть обеспечивают SSE-инвалидации; при возврате во вкладку configVersion сверяется всегда
    staleTime: 15_000,
    refetchOnWindowFocus: 'always',
    refetchInterval: status === 'fallback' ? REALTIME.pollIntervalMs : false,
  });
}

export function useTenantModules(clientSlug: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenantModules(clientSlug),
    queryFn: () => api.tenant.modules(clientSlug),
    enabled: Boolean(clientSlug) && enabled,
    staleTime: 60_000,
  });
}

export function useSubscriptionSummary(clientSlug: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.subscriptionSummary(clientSlug),
    queryFn: () => api.tenant.subscriptionSummary(clientSlug),
    enabled: Boolean(clientSlug) && enabled,
    staleTime: 60_000,
  });
}

export function useTenantUsage(clientSlug: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenantUsage(clientSlug),
    queryFn: () => api.tenant.usage(clientSlug),
    enabled: Boolean(clientSlug) && enabled,
    staleTime: 30_000,
  });
}
