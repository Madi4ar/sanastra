import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { OrganizationFilters } from '@/api/types';

export function useOrganizations(filters: OrganizationFilters) {
  return useQuery({
    queryKey: queryKeys.organizations(filters),
    queryFn: () => api.organizations.list(filters),
    placeholderData: keepPreviousData,
  });
}

/** Карточка перезапрашивается при возврате во вкладку и раз в 30 с — для обнаружения внешних изменений (оплата). */
export function useOrganization(tenantId: string) {
  return useQuery({
    queryKey: queryKeys.organization(tenantId),
    queryFn: () => api.organizations.get(tenantId),
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    staleTime: 0,
  });
}

export function useTariffPlans() {
  return useQuery({
    queryKey: queryKeys.tariffPlans,
    queryFn: api.tariffPlans.list,
    staleTime: 5 * 60_000,
  });
}

export function useTariffPlan(tariffPlanId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tariffPlan(tariffPlanId ?? ''),
    queryFn: () => api.tariffPlans.get(tariffPlanId!),
    enabled: Boolean(tariffPlanId),
    staleTime: 5 * 60_000,
  });
}
