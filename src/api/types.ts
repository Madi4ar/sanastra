export type SubscriptionStatus = 'ACTIVE' | 'BLOCKED' | 'EXPIRED';
export type ChangeSource = 'SUPERADMIN' | 'SYSTEM_PAYMENT';
export type Role = 'SUPERADMIN' | 'ORGANIZATION_ADMIN' | 'TENANT_USER';

export interface TariffPlanRef {
  id: string;
  code: string;
  name: string;
}

export interface TariffPlanSummary extends TariffPlanRef {
  description?: string;
}

export interface TariffModuleDefault {
  code: string;
  name: string;
  description?: string;
  icon?: string;
  enabled: boolean;
  canOverride: boolean;
  lockReason?: string;
}

export interface LimitDefinition {
  code: string;
  name: string;
  unit: string;
  type: 'integer' | 'decimal';
  min: number;
  max: number;
}

export interface TariffLimitDefault extends LimitDefinition {
  value: number;
}

/** Политика обработки индивидуальных настроек при смене тарифа — задаётся сервером. */
export type OverridePolicy = 'RESET' | 'KEEP_COMPATIBLE';

export interface TariffPlanDetail extends TariffPlanSummary {
  modules: TariffModuleDefault[];
  limits: TariffLimitDefault[];
  overridePolicies: OverridePolicy[];
}

export interface OrganizationListItem {
  tenantId: string;
  name: string;
  clientSlug: string;
  status: SubscriptionStatus | string;
  tariffPlan: TariffPlanRef | null;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  activeModulesCount: number;
  modulesCount: number;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrganizationModule {
  code: string;
  name: string;
  description?: string;
  icon?: string;
  tariffEnabled: boolean;
  overrideEnabled: boolean | null;
  effectiveEnabled: boolean;
  canOverride: boolean;
  lockReason?: string;
}

export interface OrganizationLimit extends LimitDefinition {
  tariffValue: number;
  overrideValue: number | null;
  effectiveValue: number;
}

export interface OrganizationDetail {
  tenantId: string;
  name: string;
  clientSlug: string;
  status: SubscriptionStatus | string;
  tariffPlan: TariffPlanRef;
  subscriptionEnabled: boolean;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  modules: OrganizationModule[];
  limits: OrganizationLimit[];
  createdAt: string;
  updatedAt: string;
  updatedBy: ChangeSource;
  version: number;
}

export interface SubscriptionSettingsPayload {
  tariffPlanId: string;
  subscriptionEnabled: boolean;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  moduleOverrides: { code: string; value: boolean | null }[];
  limitOverrides: { code: string; value: number | null }[];
  version: number;
}

export interface OrganizationFilters {
  search: string;
  status: SubscriptionStatus | '';
  tariffPlanId: string;
  page: number;
  pageSize: number;
}

/** Эффективная конфигурация организации: тариф + overrides уже объединены сервером. */
export interface TenantAccess {
  tenantId: string;
  clientSlug: string;
  organizationName: string;
  subscriptionStatus: SubscriptionStatus;
  tariff: { code: string; name: string };
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  /** Дней до окончания (вычисляет сервер, включительно) */
  daysLeft: number;
  /** За сколько дней предупреждать об окончании — конфигурация backend */
  expiryWarningDays: number;
  enabledModules: string[];
  effectiveLimits: Record<string, number>;
  configVersion: number;
  updatedAt: string;
}

export interface TenantModule {
  code: string;
  name: string;
  description: string;
  icon?: string;
  /** Право роли, необходимое для работы с модулем */
  requiredPermission: string;
}

export interface SubscriptionSummary {
  organizationName: string;
  status: SubscriptionStatus;
  tariff: { name: string; description: string };
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  daysLeft: number;
  expiryWarningDays: number;
  updatedAt: string;
  configVersion: number;
}

export type UsageState = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'EXHAUSTED';

export interface UsageItem {
  code: string;
  name: string;
  used: number;
  limit: number;
  remaining: number;
  unit: string;
  state: UsageState;
}

export interface TenantUsage {
  items: UsageItem[];
  configVersion: number;
}

export type TenantEventType =
  | 'tenant-config.updated'
  | 'subscription.updated'
  | 'subscription.blocked'
  | 'subscription.expired'
  | 'module.disabled'
  | 'limits.updated';

export type ChangedArea = 'tariff' | 'subscription' | 'modules' | 'limits';

export interface TenantEvent {
  type: TenantEventType;
  tenantId: string;
  version: number;
  changed: ChangedArea[];
  modules?: string[];
  occurredAt: string;
}

export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  clientSlug?: string;
  /** Права роли пользователя (не зависят от тарифа) */
  permissions: string[];
}

// ---------- Контент модулей кабинета ----------

export interface Course {
  id: string;
  title: string;
  category: string;
  teacher: string;
  lessonsCount: number;
  studentsCount: number;
  /** Средний прогресс учеников, % */
  progress: number;
  status: 'PUBLISHED' | 'DRAFT';
  updatedAt: string;
}

/** Статус вычисляет сервер по времени начала и длительности */
export type WebinarStatus = 'UPCOMING' | 'LIVE' | 'RECORDED';

export interface Webinar {
  id: string;
  title: string;
  speaker: string;
  startsAt: string;
  durationMin: number;
  capacity: number;
  registered: number;
  registeredByMe: boolean;
  status: WebinarStatus;
}

export interface CreateOrganizationPayload {
  name: string;
  clientSlug: string;
  tariffPlanId: string;
  subscriptionEnabled: boolean;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
}
