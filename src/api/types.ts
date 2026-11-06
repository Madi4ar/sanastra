export type SubscriptionStatus = 'ACTIVE' | 'BLOCKED' | 'EXPIRED';
export type ChangeSource = 'SUPERADMIN' | 'SYSTEM_PAYMENT' | 'SYSTEM_SCHEDULER';
/** Роли (ТЗ «Регистрация, авторизация и ролевая модель»): Суперадминистратор, Администратор клиента, Тренер, Слушатель */
/** Системные роли и кастомная глобальная роль (CUSTOM + код роли в назначении) */
export type Role = 'SUPERADMIN' | 'ORGANIZATION_ADMIN' | 'TRAINER' | 'LEARNER' | 'CUSTOM';

/** Предопределённые системные роли (is_system = true) */
export type SystemRole = Exclude<Role, 'CUSTOM'>;

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

export type SubscriptionOperation = 'ACTIVATION' | 'RENEWAL' | 'TARIFF_CHANGE' | 'UPDATE' | 'PAYMENT';

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
  /** Онлайн-оплата: выбранный период и списанная сумма */
  payment?: { months: number; amount: number };
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
  | 'limits.updated'
  | 'permissions.updated';

export type ChangedArea = 'tariff' | 'subscription' | 'modules' | 'limits' | 'permissions';

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
  /** Код кастомной глобальной роли (для role = CUSTOM) */
  customRole?: string;
  /** Название кастомной роли — для отображения */
  roleName?: string;
  clientSlug?: string;
  organizationName?: string;
}

export interface CurrentUser {
  id: string;
  fullName: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  email: string;
  iin: string;
  phone: string;
  region: string;
  /** Аватар (data URL) */
  avatar?: string;
  /** Первый вход: нужно заполнить или подтвердить данные профиля */
  onboardingRequired: boolean;
  /** Активная роль (рабочий контекст) */
  role: Role;
  /** Код и название кастомной роли, если активна кастомная роль */
  customRole?: string;
  roleName?: string;
  clientSlug?: string;
  /** Права активной роли (не зависят от тарифа) */
  permissions: string[];
  /**
   * Итоговый доступ: опции Реестра модулей, включённые в матрице роли и входящие в тариф организации
   * (Матрица глобальной роли ∩ Состав модулей тарифа)
   */
  access: string[];
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
  /** Названия кастомных ролей пользователя в организации */
  customRoles?: string[];
}

/** Назначаемая роль: системная или кастомная глобальная (`custom:<код>`) */
export type AssignableRole = 'ORGANIZATION_ADMIN' | 'TRAINER' | `custom:${string}`;

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
  /** Право удалить программу */
  canDeleteCourse: boolean;
  /** Разрешённые действия по типам элементов (итоговый доступ роли) */
  elementAccess: Partial<Record<ElementType, ElementAction[]>>;
  modules: CourseModule[];
}

export type ElementAction = 'create' | 'edit' | 'delete' | 'view';

export type ElementPayload = Pick<CourseElement, 'titleRu' | 'titleKz' | 'required' | 'hidden' | 'settings' | 'files'>;

export type StructureMove = 'up' | 'down';

/** Глобальная роль платформы с матрицей доступов */
export interface GlobalRole {
  id: string;
  /** Системный код / slug — уникальный идентификатор */
  code: string;
  name: string;
  description: string;
  /** Базовая системная роль — защищена от удаления */
  isSystem: boolean;
  /** Для системной роли — соответствующая роль платформы */
  systemRole?: SystemRole;
  /** Включённые опции Реестра модулей (полные ключи листьев); новая роль — пустая матрица */
  matrix: string[];
  /** Активные пользователи с этой ролью во всех организациях */
  usersCount: number;
  updatedAt: string;
}

export interface GlobalRolePayload {
  name: string;
  code: string;
  description: string;
}

/** Итоговый доступ роли в организации (раздел 4 ТЗ «Роли и доступы») */
export interface RoleEffectiveAccess {
  roleId: string;
  roleName: string;
  /** Модули Реестра, включённые в матрице роли */
  matrixModules: string[];
  /** Из них доступны по тарифу организации */
  availableModules: string[];
  /** Скрыты и заблокированы (403): нет в тарифе */
  blockedModules: string[];
}

/** Строка таблицы «Пользовательские роли компаний» (только чтение) */
export interface LocalRoleRow {
  id: string;
  tenantId: string;
  organizationName: string;
  roleName: string;
  departmentName: string | null;
  /** Пользователи, у которых активирована локальная роль */
  employeesCount: number;
  createdAt: string;
}

/** Отделы, сотрудники и локальные роли компании для детального просмотра */
export interface OrganizationStructure {
  tenantId: string;
  organizationName: string;
  departments: { id: string; parentId: string | null; name: string }[];
  members: { id: string; fullName: string; email: string; departmentId: string | null; active: boolean; roles: string[] }[];
  /** optionsEffective — опции матрицы, разрешённые тарифом и глобальной ролью администратора */
  roles: { id: string; name: string; optionsTotal: number; optionsEffective: number }[];
}

export type AuditEvent = 'ROLE_CREATED' | 'ROLE_DELETED' | 'ROLE_MATRIX_CHANGED' | 'USER_BOUND_TO_DEPARTMENT';

export interface AuditChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

/** Запись журнала аудита; название организации зафиксировано на момент действия */
export interface AuditEntry {
  id: string;
  at: string;
  tenantId: string;
  organizationName: string;
  adminId: string;
  event: AuditEvent;
  /** Роль или сотрудник, к которым относится действие */
  target: string;
  changes: AuditChange[];
}

// ---------- Кабинет администратора организации ----------

export type PaymentPeriod = 'YEAR' | 'MONTH';

export interface ProfilePayload {
  lastName: string;
  firstName: string;
  middleName?: string;
  phone: string;
  email: string;
  region?: string;
  /** data URL; null — удалить аватар; не передан — не менять */
  avatar?: string | null;
}

export interface BillingTariff {
  id: string;
  name: string;
  description: string;
  annualPrice: number;
  /** Годовая цена с индивидуальной скидкой организации */
  finalPrice: number;
  /** Ежемесячный платёж = Годовая цена со скидкой / 12 */
  monthlyPrice: number;
  modules: string[];
  isCurrent: boolean;
  /** Что будет оплачиваться при выборе этого тарифа */
  plan: PaymentPlan;
}

/** Месяц годового периода подписки */
export interface PaymentMonth {
  index: number;
  from: string;
  to: string;
  paid: boolean;
  paidAt: string | null;
  amount: number | null;
  /** Сегодняшний день попадает в этот месяц */
  current: boolean;
}

export interface PaymentPlan {
  /** true — продолжение текущего графика, false — новый годовой период */
  continuing: boolean;
  startDate: string;
  monthlyAmount: number;
  annualAmount: number;
  /** Уже оплачено по графику */
  paidAmount: number;
  months: PaymentMonth[];
}

export interface BillingInfo {
  status: SubscriptionStatus;
  tariffName: string;
  tariffDescription: string;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  /** Зафиксированные суперадминистратором цена и скидка текущего периода */
  basePrice: number;
  discount: Discount;
  finalPrice: number;
  history: SubscriptionHistoryEntry[];
  /** Месяцы текущей подписки: оплаченные и нет */
  months: PaymentMonth[];
  /** Текущий тариф и тарифы для перехода */
  tariffs: BillingTariff[];
}

export interface PaymentOrder {
  id: string;
  tariffPlanId: string;
  tariffName: string;
  period: PaymentPeriod;
  /** Оплачиваемые месяцы графика */
  months: number[];
  amount: number;
}

/** Модуль платформы в кабинете администратора: рабочий или демо с предложением апгрейда */
export interface CatalogModule {
  code: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  /** Ближайший тариф, в который входит закрытый модуль */
  upgradeTariff: { id: string; name: string } | null;
}

export type SystemOrgRole = 'ORGANIZATION_ADMIN' | 'TRAINER' | 'LEARNER';

export interface OrgMember {
  id: string;
  fullName: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  iin: string;
  email: string;
  phone: string;
  region: string;
  active: boolean;
  /** Основная роль в организации */
  role: SystemOrgRole | null;
  departmentId: string | null;
  departmentName: string | null;
  localRoleIds: string[];
  localRoleNames: string[];
  isSelf: boolean;
}

export interface OrgMemberPayload {
  iin: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  email: string;
  phone: string;
  region: string;
  /** При редактировании необязателен */
  password?: string;
  role: SystemOrgRole;
  departmentId: string | null;
  localRoleIds: string[];
}

export type DepartmentKind = 'DEPARTMENT' | 'MANAGEMENT' | 'BRANCH' | 'UNIT';

export interface OrgDepartment {
  id: string;
  parentId: string | null;
  name: string;
  kind: DepartmentKind;
  headMemberId: string | null;
  headName: string | null;
  membersCount: number;
}

export interface OrgDepartmentPayload {
  name: string;
  kind: DepartmentKind;
  parentId: string | null;
  headMemberId: string | null;
}

export interface TenantRole {
  id: string;
  nameRu: string;
  nameKz: string;
  description: string;
  isSystem: boolean;
  /** Включённые опции; вне тарифа они работают только в демо-режиме */
  matrix: string[];
  /** Сколько включённых опций вне тарифа */
  demoOptions: number;
  scope: 'DEPARTMENT' | 'MEMBERS' | null;
  departmentId: string | null;
  memberIds: string[];
  employeesCount: number;
}

export interface TenantRolesData {
  roles: TenantRole[];
  /** Все модули и опции глобальной роли администратора: из них собирается матрица */
  catalog: RegistryModule[];
  /** Модули вне тарифа организации: ключ модуля → название тарифа, в котором он есть */
  demoModules: Record<string, string | null>;
}

export interface TenantRolePayload {
  nameRu: string;
  nameKz: string;
  description: string;
  scope: 'DEPARTMENT' | 'MEMBERS';
  departmentId: string | null;
  memberIds: string[];
  matrix: string[];
}

export interface OrgGroup {
  id: string;
  name: string;
  courseId: string | null;
  courseTitle: string | null;
  startDate: string | null;
  endDate: string | null;
  /** Дни занятий: 0 — понедельник … 6 — воскресенье */
  days: number[];
  timeFrom: string | null;
  timeTo: string | null;
  listenerIds: string[];
  createdAt: string;
}

export type OrgGroupPayload = Pick<OrgGroup, 'name' | 'courseId' | 'startDate' | 'endDate' | 'days' | 'timeFrom' | 'timeTo'>;

export type ReportType = 'PERFORMANCE' | 'COMPLETION' | 'ATTENDANCE' | 'ACTIVITY';

export interface ReportResult {
  type: ReportType;
  title: string;
  columns: { key: string; title: string }[];
  rows: Record<string, string | number>[];
  generatedAt: string;
}
