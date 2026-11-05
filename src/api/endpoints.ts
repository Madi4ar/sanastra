import { request, toQueryString } from './client';
import type {
  Course,
  CreateOrganizationPayload,
  CurrentUser,
  OrganizationDetail,
  OrganizationFilters,
  OrganizationListItem,
  Paginated,
  Role,
  SubscriptionSettingsPayload,
  TariffPlanDetail,
  SubscriptionSummary,
  TariffPlanSummary,
  TenantAccess,
  TenantModule,
  TenantUsage,
  Webinar,
} from './types';

export interface ModuleData {
  title: string;
  /** Тип содержимого: курсы и вебинары имеют собственные экраны */
  kind: 'generic' | 'courses' | 'webinars';
  items: string[];
  courses?: Course[];
  categories?: string[];
  webinars?: Webinar[];
  /** Действие создания, ограниченное лимитом (если есть) */
  create?: { label: string; limitCode: string; available: boolean };
}

export const api = {
  auth: {
    me: () => request<CurrentUser>('/api/auth/me'),
    login: (role: Role) => request<CurrentUser>('/api/auth/login', { method: 'POST', body: JSON.stringify({ role }) }),
    logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  },
  organizations: {
    list: (f: OrganizationFilters) =>
      request<Paginated<OrganizationListItem>>(
        `/api/superadmin/organizations${toQueryString({
          search: f.search,
          status: f.status,
          tariffPlanId: f.tariffPlanId,
          page: f.page,
          pageSize: f.pageSize,
        })}`,
      ),
    create: (payload: CreateOrganizationPayload) =>
      request<OrganizationDetail>('/api/superadmin/organizations', { method: 'POST', body: JSON.stringify(payload) }),
    slugAvailable: (slug: string) =>
      request<{ available: boolean }>(`/api/superadmin/organizations/slug-availability${toQueryString({ slug })}`),
    get: (tenantId: string) => request<OrganizationDetail>(`/api/superadmin/organizations/${encodeURIComponent(tenantId)}`),
    saveSettings: (tenantId: string, payload: SubscriptionSettingsPayload) =>
      request<OrganizationDetail>(
        `/api/superadmin/organizations/${encodeURIComponent(tenantId)}/subscription-settings`,
        { method: 'PATCH', body: JSON.stringify(payload) },
      ),
  },
  tariffPlans: {
    list: () => request<TariffPlanSummary[]>('/api/superadmin/tariff-plans'),
    get: (id: string) => request<TariffPlanDetail>(`/api/superadmin/tariff-plans/${encodeURIComponent(id)}`),
  },
  tenant: {
    access: (clientSlug: string) => request<TenantAccess>(`/api/tenant/access${toQueryString({ clientSlug })}`),
    subscriptionSummary: (clientSlug: string) =>
      request<SubscriptionSummary>(`/api/tenant/subscription-summary${toQueryString({ clientSlug })}`),
    modules: (clientSlug: string) => request<TenantModule[]>(`/api/tenant/modules${toQueryString({ clientSlug })}`),
    usage: (clientSlug: string) => request<TenantUsage>(`/api/tenant/usage${toQueryString({ clientSlug })}`),
    moduleData: (clientSlug: string, moduleCode: string) =>
      request<ModuleData>(
        `/api/tenant/modules/${encodeURIComponent(moduleCode)}/data${toQueryString({ clientSlug })}`,
      ),
    createInModule: (clientSlug: string, moduleCode: string, data: Record<string, string> = {}) =>
      request<{ ok: true }>(
        `/api/tenant/modules/${encodeURIComponent(moduleCode)}/items${toQueryString({ clientSlug })}`,
        { method: 'POST', body: JSON.stringify(data) },
      ),
    toggleWebinarRegistration: (clientSlug: string, webinarId: string) =>
      request<{ registered: boolean }>(
        `/api/tenant/webinars/${encodeURIComponent(webinarId)}/registration${toQueryString({ clientSlug })}`,
        { method: 'POST', body: '{}' },
      ),
  },
};
