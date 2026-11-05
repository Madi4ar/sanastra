import { QueryClient } from '@tanstack/react-query';
import { isApiError, onApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { onCrossTabMessage } from '@/shared/crossTab';

export function createQueryClient() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // 4xx не повторяем — это осмысленные ответы сервера (в т.ч. запрещённые запросы модуля)
        retry: (count, error) => !(isApiError(error) && error.status >= 400 && error.status < 500) && count < 2,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
  return qc;
}

/** Глобальная реакция на ошибки API (раздел 29) и межвкладочные сигналы. Возвращает функцию отписки. */
export function wireQueryClient(qc: QueryClient) {
  const invalidateAccess = () => void qc.invalidateQueries({ queryKey: queryKeys.tenantAccessAll });
  const offError = onApiError((error) => {
    switch (error.code) {
      case 'UNAUTHORIZED':
        qc.setQueryData(queryKeys.me, null);
        break;
      // Сервер отозвал доступ: обновляем конфигурацию, UI сам перенаправит (блокировка / dashboard)
      case 'MODULE_DISABLED':
      case 'TENANT_BLOCKED':
      case 'SUBSCRIPTION_EXPIRED':
        invalidateAccess();
        break;
      case 'LIMIT_REACHED':
        void qc.invalidateQueries({ queryKey: ['tenant-usage'] });
        void qc.invalidateQueries({ queryKey: ['tenant-module'] });
        break;
      default:
    }
  });
  const offTab = onCrossTabMessage((m) => {
    if (m.type === 'tenant-access-invalidated') invalidateAccess();
  });
  return () => {
    offError();
    offTab();
  };
}
