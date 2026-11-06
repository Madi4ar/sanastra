import { request, toQueryString } from './client';
import type {
  Course,
  CreateOrganizationPayload,
  CurrentUser,
  OrganizationDetail,
  OrganizationFilters,
  OrganizationListItem,
  OrganizationProfilePayload,
  Paginated,
  AssignableRole,
  OrganizationUser,
  PlatformUser,
  PlatformUserPayload,
  Region,
  RegisterPayload,
  RegistryModule,
  RegistryPublishPayload,
  RegistryRenamePayload,
  RoleAssignment,
  SubscriptionSettingsPayload,
  TariffPlanDetail,
  TariffPlanPayload,
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
    /** Шаг 1 входа: поиск ИИН в базе */
    checkIin: (iin: string) => request<{ exists: true }>('/api/auth/check-iin', { method: 'POST', body: JSON.stringify({ iin }) }),
    /** Шаг 2 входа: ИИН + пароль */
    login: (iin: string, password: string) =>
      request<CurrentUser>('/api/auth/login', { method: 'POST', body: JSON.stringify({ iin, password }) }),
    register: (payload: RegisterPayload) =>
      request<CurrentUser>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
    switchRole: (target: Pick<RoleAssignment, 'role' | 'clientSlug'>) =>
      request<CurrentUser>('/api/auth/switch-role', { method: 'POST', body: JSON.stringify(target) }),
    logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  },
  dictionaries: {
    regions: () => request<Region[]>('/api/dictionaries/regions'),
  },
  organizationUsers: {
    list: (clientSlug: string) => request<OrganizationUser[]>(`/api/organizations/${encodeURIComponent(clientSlug)}/users`),
    assignRole: (clientSlug: string, iin: string, role: AssignableRole) =>
      request<OrganizationUser>(`/api/organizations/${encodeURIComponent(clientSlug)}/users/roles`, {
        method: 'POST',
        body: JSON.stringify({ iin, role }),
      }),
  },
  platform: {
    users: (search: string) => request<PlatformUser[]>(`/api/superadmin/users${toQueryString({ search })}`),
    createUser: (payload: PlatformUserPayload) =>
      request<PlatformUser>('/api/superadmin/users', { method: 'POST', body: JSON.stringify(payload) }),
    updateUser: (id: string, payload: PlatformUserPayload) =>
      request<PlatformUser>(`/api/superadmin/users/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    deleteUser: (id: string) => request<void>(`/api/superadmin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
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
    remove: (tenantId: string) =>
      request<void>(`/api/superadmin/organizations/${encodeURIComponent(tenantId)}`, { method: 'DELETE' }),
    updateProfile: (tenantId: string, payload: OrganizationProfilePayload) =>
      request<OrganizationDetail>(`/api/superadmin/organizations/${encodeURIComponent(tenantId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    saveSettings: (tenantId: string, payload: SubscriptionSettingsPayload) =>
      request<OrganizationDetail>(
        `/api/superadmin/organizations/${encodeURIComponent(tenantId)}/subscription-settings`,
        { method: 'PATCH', body: JSON.stringify(payload) },
      ),
  },
  tariffPlans: {
    list: () => request<TariffPlanSummary[]>('/api/superadmin/tariff-plans'),
    get: (id: string) => request<TariffPlanDetail>(`/api/superadmin/tariff-plans/${encodeURIComponent(id)}`),
    create: (payload: TariffPlanPayload) =>
      request<TariffPlanDetail>('/api/superadmin/tariff-plans', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: TariffPlanPayload) =>
      request<TariffPlanDetail>(`/api/superadmin/tariff-plans/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
  },
  moduleRegistry: {
    list: () => request<RegistryModule[]>('/api/superadmin/module-registry'),
    /** Только переименование отображаемого названия — удаление и выключение в реестре отсутствуют */
    rename: (payload: RegistryRenamePayload) =>
      request<RegistryModule>('/api/superadmin/module-registry/display-name', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
  },
  /** Системный API для разработки (CI/CD): публикация или обновление модуля в реестре */
  system: {
    publishModule: (payload: RegistryPublishPayload) =>
      request<RegistryModule>('/api/system/module-registry', { method: 'POST', body: JSON.stringify(payload) }),
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
