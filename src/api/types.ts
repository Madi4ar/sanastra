export type SubscriptionStatus = 'ACTIVE' | 'BLOCKED' | 'EXPIRED';
export type ChangeSource = 'SUPERADMIN' | 'SYSTEM_PAYMENT' | 'SYSTEM_SCHEDULER';
/** Роли (ТЗ «Регистрация, авторизация и ролевая модель»): Суперадминистратор, Администратор клиента, Тренер, Слушатель */
export type Role = 'SUPERADMIN' | 'ORGANIZATION_ADMIN' | 'TRAINER' | 'LEARNER';

export interface TariffPlanRef {
  id: string;
  code: string;
  name: string;
}

export interface TariffPlanSummary extends TariffPlanRef {
  description?: string;
  /** Годовая цена, KZT за 12 месяцев */
  annualPrice: number;
  limits: Record<string, number>;
  enabledModulesCount: number;
  organizationsCount: number;
}

/** Форма конструктора тарифов (создание и редактирование) */
export interface TariffPlanPayload {
  name: string;
  code: string;
  description?: string;
  annualPrice: number;
  limits: Record<string, number>;
  modules: Record<string, boolean>;
}

/** Ручная скидка на годовую цену: в KZT или в % */
export type DiscountType = 'AMOUNT' | 'PERCENT';

export interface Discount {
  type: DiscountType;
  value: number;
}

export type SubscriptionOperation = 'ACTIVATION' | 'RENEWAL' | 'TARIFF_CHANGE' | 'UPDATE';

/** Запись неизменяемой истории тарифов и периодов подписки */
export interface SubscriptionHistoryEntry {
  id: string;
  operation: SubscriptionOperation;
  operationAt: string;
  tariffName: string;
  periodStart: string;
  periodEnd: string;
  basePrice: number;
  discount: Discount;
  finalPrice: number;
  status: 'ACTIVE' | 'COMPLETED';
  source: ChangeSource;
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

export interface TariffPlanDetail extends Omit<TariffPlanSummary, 'limits'> {
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
  /** Окончание доступа к модулю, включённому сверх тарифа (null — бессрочно) */
  expiresAt: string | null;
  canOverride: boolean;
  lockReason?: string;
}

/** Лимиты зафиксированы в тарифе (на момент оформления периода) и в карточке только для чтения */
export interface OrganizationLimit extends LimitDefinition {
  value: number;
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
  /** Условия текущего периода: базовая годовая цена фиксируется при оформлении/продлении */
  pricing: { annualPrice: number; discount: Discount; finalPrice: number };
  history: SubscriptionHistoryEntry[];
  /** Использование ресурсов (считает сервер): потрачено и осталось по каждому лимиту */
  usage: UsageItem[];
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
  discount: Discount;
  moduleOverrides: { code: string; value: boolean | null; expiresAt: string | null }[];
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

/** Роль пользователя; для клиентских ролей указана организация */
export interface RoleAssignment {
  role: Role;
  clientSlug?: string;
  organizationName?: string;
}

export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  iin: string;
  phone: string;
  region: string;
  /** Активная роль (рабочий контекст) */
  role: Role;
  clientSlug?: string;
  /** Права активной роли (не зависят от тарифа) */
  permissions: string[];
  /** Все активные роли пользователя — для переключения в шапке профиля */
  roles: RoleAssignment[];
}

export interface Region {
  code: string;
  name: string;
}

export interface RegisterPayload {
  iin: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  region: string;
  phone: string;
  email: string;
  password: string;
}

/** Пользователь организации в разделе «Пользователи» */
export interface OrganizationUser {
  id: string;
  fullName: string;
  iin: string;
  email: string;
  roles: Role[];
}

export type AssignableRole = 'ORGANIZATION_ADMIN' | 'TRAINER';

/** Пользователь платформы (раздел «Пользователи» суперадмина) */
export interface PlatformUser {
  id: string;
  fullName: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  iin: string;
  email: string;
  phone: string;
  region: string;
  roles: RoleAssignment[];
}

/** Создание / редактирование пользователя суперадминистратором. При редактировании пароль необязателен,
 * а список ролей позволяет снять роли (новые роли назначаются через «Назначить роль»). */
export interface PlatformUserPayload extends Omit<RegisterPayload, 'password'> {
  password?: string;
  roles?: Pick<RoleAssignment, 'role' | 'clientSlug'>[];
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
