import { request, toQueryString } from './client';
import type {
  Course,
  DirectoryItem,
  DirectoryItemPayload,
  DirectoryOption,
  DirectorySummary,
  TenantDirectorySummary,
  BillingInfo,
  CatalogModule,
  OrgDepartment,
  OrgDepartmentPayload,
  OrgGroup,
  OrgGroupPayload,
  OrgMember,
  OrgMemberPayload,
  OrgTrainer,
  TrainerCandidate,
  PaymentOrder,
  PaymentPeriod,
  ProfilePayload,
  ReportResult,
  ReportType,
  TenantRole,
  TenantRolePayload,
  TenantRolesData,
  CourseContent,
  CourseElement,
  ElementPayload,
  ElementType,
  StructureMove,
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
  GlobalRole,
  GlobalRolePayload,
  RoleEffectiveAccess,
  LocalRoleRow,
  OrganizationStructure,
  AuditEntry,
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
    switchRole: (target: Pick<RoleAssignment, 'role' | 'clientSlug' | 'customRole'>) =>
      request<CurrentUser>('/api/auth/switch-role', { method: 'POST', body: JSON.stringify(target) }),
    logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
    updateProfile: (payload: ProfilePayload) =>
      request<CurrentUser>('/api/auth/profile', { method: 'PUT', body: JSON.stringify(payload) }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<void>('/api/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  },
  dictionaries: {
    regions: () => request<Region[]>('/api/dictionaries/regions'),
  },
  organizationUsers: {
    list: (clientSlug: string) => request<OrganizationUser[]>(`/api/organizations/${encodeURIComponent(clientSlug)}/users`),
    /** Роли, которые можно назначить в организации: системные и кастомные глобальные */
    assignableRoles: (clientSlug: string) =>
      request<{ value: AssignableRole; label: string }[]>(`/api/organizations/${encodeURIComponent(clientSlug)}/assignable-roles`),
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
  /** Глобальные роли платформы и их матрицы доступов */
  roles: {
    list: () => request<GlobalRole[]>('/api/superadmin/roles'),
    create: (payload: GlobalRolePayload) =>
      request<GlobalRole>('/api/superadmin/roles', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: GlobalRolePayload) =>
      request<GlobalRole>(`/api/superadmin/roles/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    saveMatrix: (id: string, matrix: string[]) =>
      request<GlobalRole>(`/api/superadmin/roles/${encodeURIComponent(id)}/matrix`, {
        method: 'PUT',
        body: JSON.stringify({ matrix }),
      }),
    remove: (id: string) => request<void>(`/api/superadmin/roles/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    /** Итоговый доступ ролей в организации (матрица ∩ тариф) */
    effectiveIn: (tenantId: string) =>
      request<RoleEffectiveAccess[]>(`/api/superadmin/organizations/${encodeURIComponent(tenantId)}/role-access`),
  },
  /** Мониторинг внутренней структуры компаний: только чтение */
  localRoles: {
    list: (f: { search: string; page: number; pageSize: number }) =>
      request<Paginated<LocalRoleRow>>(`/api/superadmin/local-roles${toQueryString(f)}`),
    audit: (f: { page: number; pageSize: number }) =>
      request<Paginated<AuditEntry>>(`/api/superadmin/local-roles/audit${toQueryString(f)}`),
    structure: (tenantId: string) =>
      request<OrganizationStructure>(`/api/superadmin/organizations/${encodeURIComponent(tenantId)}/structure`),
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
  /** Справочники суперадминистратора: глобальные записи */
  directories: {
    list: () => request<DirectorySummary[]>('/api/superadmin/directories'),
    items: (code: string) => request<DirectoryItem[]>(`/api/superadmin/directories/${code}/items`),
    create: (code: string, payload: DirectoryItemPayload) =>
      request<DirectoryItem>(`/api/superadmin/directories/${code}/items`, { method: 'POST', body: JSON.stringify(payload) }),
    update: (code: string, id: string, payload: DirectoryItemPayload) =>
      request<DirectoryItem>(`/api/superadmin/directories/${code}/items/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    remove: (code: string, id: string) => request<void>(`/api/superadmin/directories/${code}/items/${id}`, { method: 'DELETE' }),
  },
  /** Справочники организации: глобальные записи и собственные локальные */
  tenantDirectories: (clientSlug: string) => {
    const q = toQueryString({ clientSlug });
    return {
      list: () => request<TenantDirectorySummary[]>(`/api/tenant/directories${q}`),
      options: (code: string) => request<DirectoryOption[]>(`/api/tenant/directories/${code}/options${q}`),
      items: (code: string) => request<DirectoryItem[]>(`/api/tenant/directories/${code}/items${q}`),
      create: (code: string, payload: DirectoryItemPayload) =>
        request<DirectoryItem>(`/api/tenant/directories/${code}/items${q}`, { method: 'POST', body: JSON.stringify(payload) }),
      update: (code: string, id: string, payload: DirectoryItemPayload) =>
        request<DirectoryItem>(`/api/tenant/directories/${code}/items/${id}${q}`, { method: 'PUT', body: JSON.stringify(payload) }),
      remove: (code: string, id: string) => request<void>(`/api/tenant/directories/${code}/items/${id}${q}`, { method: 'DELETE' }),
    };
  },
  /** Кабинет администратора организации */
  tenantAdmin: (clientSlug: string) => {
    const q = toQueryString({ clientSlug });
    const send = <T>(path: string, method: string, body?: unknown) =>
      request<T>(`/api/tenant${path}${q}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    return {
      catalog: () => send<CatalogModule[]>('/module-catalog', 'GET'),
      billing: () => send<BillingInfo>('/billing', 'GET'),
      createPayment: (tariffPlanId: string, period: PaymentPeriod, months: number[]) =>
        send<PaymentOrder>('/payments', 'POST', { tariffPlanId, period, months }),
      /** Результат эквайринга (вебхук). Данные карты на сервер не передаются. */
      completePayment: (id: string, outcome: 'SUCCESS' | 'DECLINED') =>
        send<BillingInfo>(`/payments/${encodeURIComponent(id)}/webhook`, 'POST', { outcome }),
      members: () => send<OrgMember[]>('/members', 'GET'),
      createMember: (payload: OrgMemberPayload) => send<OrgMember>('/members', 'POST', payload),
      updateMember: (id: string, payload: OrgMemberPayload) => send<OrgMember>(`/members/${id}`, 'PUT', payload),
      setMemberActive: (id: string, active: boolean) => send<OrgMember>(`/members/${id}/active`, 'PUT', { active }),
      trainers: () => send<OrgTrainer[]>('/trainers', 'GET'),
      searchTrainers: (q: string) =>
        request<TrainerCandidate[]>(`/api/tenant/trainers/search${toQueryString({ clientSlug, q })}`),
      addTrainer: (userId: string, categoryId: string | null) => send<OrgTrainer>('/trainers', 'POST', { userId, categoryId }),
      setTrainerActive: (id: string, active: boolean) => send<OrgTrainer>(`/trainers/${id}/status`, 'PUT', { active }),
      departments: () => send<OrgDepartment[]>('/departments', 'GET'),
      createDepartment: (payload: OrgDepartmentPayload) => send<OrgDepartment>('/departments', 'POST', payload),
      updateDepartment: (id: string, payload: OrgDepartmentPayload) => send<OrgDepartment>(`/departments/${id}`, 'PUT', payload),
      removeDepartment: (id: string) => send<void>(`/departments/${id}`, 'DELETE'),
      bindMembers: (id: string, memberIds: string[]) => send<void>(`/departments/${id}/members`, 'POST', { memberIds }),
      roles: () => send<TenantRolesData>('/local-roles', 'GET'),
      createRole: (payload: TenantRolePayload) => send<TenantRole>('/local-roles', 'POST', payload),
      updateRole: (id: string, payload: TenantRolePayload) => send<TenantRole>(`/local-roles/${id}`, 'PUT', payload),
      removeRole: (id: string) => send<void>(`/local-roles/${id}`, 'DELETE'),
      groups: () => send<OrgGroup[]>('/groups', 'GET'),
      createGroup: (payload: OrgGroupPayload) => send<OrgGroup>('/groups', 'POST', payload),
      updateGroup: (id: string, payload: OrgGroupPayload) => send<OrgGroup>(`/groups/${id}`, 'PUT', payload),
      removeGroup: (id: string) => send<void>(`/groups/${id}`, 'DELETE'),
      addListeners: (id: string, memberIds: string[]) => send<OrgGroup>(`/groups/${id}/listeners`, 'POST', { memberIds }),
      removeListener: (id: string, memberId: string) => send<OrgGroup>(`/groups/${id}/listeners/${memberId}`, 'DELETE'),
      report: (type: ReportType, f: { groupId?: string; courseId?: string; positionId?: string }) =>
        request<ReportResult>(`/api/tenant/reports/${type}${toQueryString({ clientSlug, ...f })}`),
      updateCourse: (
        id: string,
        payload: { title: string; category: string; formatId: string | null; assessmentId: string | null; languageId: string | null },
      ) =>
        send<Course>(`/courses/${encodeURIComponent(id)}`, 'PATCH', payload),
      removeCourse: (id: string) => send<void>(`/courses/${encodeURIComponent(id)}`, 'DELETE'),
    };
  },
  /** Конструктор курса: модули → дни → элементы контента */
  courseBuilder: (clientSlug: string, courseId: string) => {
    const base = `/api/tenant/courses/${encodeURIComponent(courseId)}`;
    const q = toQueryString({ clientSlug });
    const send = <T>(path: string, method: string, body?: unknown) =>
      request<T>(`${base}${path}${q}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    return {
      get: () => request<CourseContent>(`${base}/content${q}`),
      addModule: (title: string) => send<CourseContent>('/modules', 'POST', { title }),
      renameModule: (id: string, title: string) => send<CourseContent>(`/modules/${id}`, 'PATCH', { title }),
      removeModule: (id: string) => send<CourseContent>(`/modules/${id}`, 'DELETE'),
      moveModule: (id: string, direction: StructureMove) => send<CourseContent>(`/modules/${id}/move`, 'POST', { direction }),
      addDay: (moduleId: string, title: string) => send<CourseContent>(`/modules/${moduleId}/days`, 'POST', { title }),
      renameDay: (id: string, title: string) => send<CourseContent>(`/days/${id}`, 'PATCH', { title }),
      removeDay: (id: string) => send<CourseContent>(`/days/${id}`, 'DELETE'),
      addElement: (dayId: string, type: ElementType, titleRu: string, titleKz: string) =>
        send<CourseElement>(`/days/${dayId}/elements`, 'POST', { type, titleRu, titleKz }),
      updateElement: (id: string, payload: ElementPayload) => send<CourseElement>(`/elements/${id}`, 'PUT', payload),
      removeElement: (id: string) => send<CourseContent>(`/elements/${id}`, 'DELETE'),
      moveElement: (id: string, direction: StructureMove) => send<CourseContent>(`/elements/${id}/move`, 'POST', { direction }),
    };
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
