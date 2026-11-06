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

/** Данные организации, введённые при создании (редактирование) */
export interface OrganizationProfilePayload {
  name: string;
  clientSlug: string;
}

export interface CreateOrganizationPayload {
  name: string;
  clientSlug: string;
  tariffPlanId: string;
  subscriptionEnabled: boolean;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
}

/** Опция модуля в реестре: атомарная функция (может содержать вложенные опции) */
export interface RegistryOption {
  /** Полный системный ключ: `lms_prog_core.create` */
  key: string;
  /** Системное название, переданное разработкой */
  systemName: string;
  /** Коммерческое название, заданное суперадминистратором (null — показывается системное) */
  displayName: string | null;
  options?: RegistryOption[];
}

export interface RegistryVersion {
  version: string;
  publishedAt: string;
  /** Канал публикации: CI/CD-пайплайн или системный API */
  publishedBy: 'CI_CD' | 'SYSTEM_API';
}

/** Модуль реестра — отражает технологический срез кода; удаление и выключение недоступны */
export interface RegistryModule {
  key: string;
  systemName: string;
  displayName: string | null;
  /** Текущая версия */
  version: string;
  updatedAt: string;
  /** История версий, новые сверху */
  versions: RegistryVersion[];
  options: RegistryOption[];
}

/** Публикация/обновление модуля разработкой (CI/CD или системный API) */
export interface RegistryPublishPayload {
  key: string;
  systemName: string;
  /** Семантическая версия: 1.2.0 */
  version: string;
  options: RegistryPublishOption[];
}

/** Опция в публикации: ключ — сегмент внутри родителя (`create`), полный ключ собирает сервер */
export interface RegistryPublishOption {
  key: string;
  systemName: string;
  options?: RegistryPublishOption[];
}

/** Переименование элемента реестра (модуля или опции); null — вернуть системное название */
export interface RegistryRenamePayload {
  key: string;
  displayName: string | null;
}

/** Элементы контента конструктора курсов (перенесено из ESUS LMS) */
export type ElementType =
  | 'text'
  | 'video'
  | 'interactive_video'
  | 'audio'
  | 'document'
  | 'presentation'
  | 'folder'
  | 'image'
  | 'link'
  | 'scorm'
  | 'assignment'
  | 'table'
  | 'test'
  | 'survey'
  | 'reflection';

/** Файл элемента. Язык: '' — для обоих языков */
export interface ElementFile {
  id: string;
  name: string;
  size: number;
  mime: string;
  lang: '' | 'kz' | 'ru';
  /** Папка внутри элемента «Папка» (null — корень) */
  folderId: string | null;
  /** Превью картинки (data URL), если файл небольшой */
  dataUrl?: string;
  uploadedAt: string;
}

export interface CourseElement {
  id: string;
  type: ElementType;
  titleRu: string;
  titleKz: string;
  /** Обязательный для завершения курса */
  required: boolean;
  /** Скрыт от слушателей */
  hidden: boolean;
  /** Настройки типа — см. features/course-builder/elementTypes.ts */
  settings: Record<string, unknown>;
  files: ElementFile[];
  updatedAt: string;
}

export interface CourseDay {
  id: string;
  title: string;
  elements: CourseElement[];
}

export interface CourseModule {
  id: string;
  title: string;
  days: CourseDay[];
}

export interface CourseContent {
  course: Course;
  /** Право редактировать структуру и элементы (courses.manage) */
  canEdit: boolean;
  modules: CourseModule[];
}

export type ElementPayload = Pick<CourseElement, 'titleRu' | 'titleKz' | 'required' | 'hidden' | 'settings' | 'files'>;

export type StructureMove = 'up' | 'down';
