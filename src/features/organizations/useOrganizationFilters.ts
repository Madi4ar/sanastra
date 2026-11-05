import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { OrganizationFilters, SubscriptionStatus } from '@/api/types';

export const PAGE_SIZES = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;
const STATUSES: SubscriptionStatus[] = ['ACTIVE', 'BLOCKED', 'EXPIRED'];

export function parseFilters(sp: URLSearchParams): OrganizationFilters {
  const status = sp.get('status') ?? '';
  const page = Number(sp.get('page'));
  const pageSize = Number(sp.get('pageSize'));
  return {
    search: sp.get('search') ?? '',
    status: (STATUSES as string[]).includes(status) ? (status as SubscriptionStatus) : '',
    tariffPlanId: sp.get('tariffPlanId') ?? '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
  };
}

function toParams(f: OrganizationFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.search) sp.set('search', f.search);
  if (f.status) sp.set('status', f.status);
  if (f.tariffPlanId) sp.set('tariffPlanId', f.tariffPlanId);
  sp.set('page', String(f.page));
  sp.set('pageSize', String(f.pageSize));
  return sp;
}

/** Поиск, фильтры и пагинация живут в URL — ссылку можно сохранить и передать. */
export function useOrganizationFilters() {
  const [sp, setSp] = useSearchParams();
  const filters = useMemo(() => parseFilters(sp), [sp]);

  const update = useCallback(
    (patch: Partial<OrganizationFilters>, opts: { replace?: boolean } = {}) => {
      setSp(
        (prev) => {
          const current = parseFilters(prev);
          const resetsPage = 'search' in patch || 'status' in patch || 'tariffPlanId' in patch || 'pageSize' in patch;
          return toParams({ ...current, ...(resetsPage ? { page: 1 } : {}), ...patch });
        },
        { replace: opts.replace },
      );
    },
    [setSp],
  );

  const reset = useCallback(() => setSp(toParams(parseFilters(new URLSearchParams()))), [setSp]);

  const hasActiveFilters = Boolean(filters.search || filters.status || filters.tariffPlanId);
  return { filters, update, reset, hasActiveFilters };
}
