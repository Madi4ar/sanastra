import { delay, http, HttpResponse, sse, type HttpHandler } from 'msw';
import dayjs from 'dayjs';
import type {
  AssignableRole,
  ChangedArea,
  OrganizationUser,
  RegisterPayload,
  Role,
  RoleAssignment,
  CreateOrganizationPayload,
  OrganizationProfilePayload,
  ChangeSource,
  CurrentUser,
  PlatformUserPayload,
  ProfilePayload,
  Discount,
  SubscriptionHistoryEntry,
  SubscriptionOperation,
  SubscriptionSettingsPayload,
  TariffPlanPayload,
  RegistryPublishPayload,
  LocalRoleRow,
  OrganizationStructure,
  GlobalRolePayload,
  RoleEffectiveAccess,
  ElementPayload,
  ElementType,
  StructureMove,
  RegistryRenamePayload,
  TenantEvent,
} from '@/api/types';
import { finalPrice, NO_DISCOUNT } from '@/shared/pricing';
import { RESERVED_SLUGS, SLUG_PATTERN, slugError } from '@/shared/slug';
import {
  computeStatus,
  effectiveLimitValues,
  effectiveModules,
  findTariff,
  getSession,
  LIMITS,
  load,
  MODULES,
  save,
  setSession,
  toAccess,
  toDetail,
  toListItem,
  toSummary,
  toTariffDetail,
  toTariffSummary,
  toTenantModules,
  toUsage,
  type OrgRecord,
  type TariffRecord,
} from './db';
import { publish, subscribe } from './eventBus';
import {
  fullNameOf,
  hashPassword,
  loadUsers,
  LOCK_MINUTES,
  MAX_FAILED_ATTEMPTS,
  REGIONS,
  ROLE_PRIORITY,
  accessFor,
  sameAssignment,
  saveUsers,
  toCurrentUser,
  type UserRecord,
} from './users';
import { EMAIL_PATTERN, isValidIin, isValidKzPhone, isValidPassword, MESSAGES, phoneDigits } from '@/features/auth/validation';
import { isDeactivated, loadStructure, removeStructure, roleHolders, syncMembers } from './orgStructure';
import { tenantAdminHandlers } from './tenantAdminHandlers';
import { loadRegistry, publishModule, renameNode, validatePublish } from './registry';
import { findCustomRole, loadRoles, saveRoles, type GlobalRoleRecord } from './roles';
import { allLeafKeys, canElement, effectiveAccess, inTariff, modulesOf } from '@/shared/access';
import {
  addCourse,
  COURSE_CATEGORIES,
  courseCount,
  findCourse,
  listCourses,
  listWebinars,
  removeContent,
  toggleWebinarRegistration,
  touchCourse,
} from './content';
import { ELEMENT_TYPES } from '@/features/course-builder/elementTypes';
import {
  applyElement,
  findDay,
  findElement,
  getStructure,
  move,
  mutate,
  newElement,
  removeCourseContentOf,
} from './courseBuilder';

export const latency = () => {
  // Отложенные задачи планировщика выполняются до обработки запроса (плюс интервал в browser.ts)
  runModuleExpirations();
  return delay(import.meta.env.MODE === 'test' ? 0 : 250);
};

export const err = (status: number, code: string, message?: string, fieldErrors?: Record<string, string>) =>
  HttpResponse.json({ code, message, fieldErrors }, { status });

function requireRole(role?: CurrentUser['role']) {
  const session = getSession();
  if (!session) return err(401, 'UNAUTHORIZED');
  if (role && session.role !== role) return err(403, 'FORBIDDEN');
  return null;
}

const isIsoDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && dayjs(v).isValid();

function validateSettings(body: Partial<SubscriptionSettingsPayload>): Record<string, string> {
  const fe: Record<string, string> = {};
  if (!body.tariffPlanId || !findTariff(body.tariffPlanId)) fe.tariffPlanId = 'Выберите тарифный план из справочника';
  if (!isIsoDate(body.subscriptionStartDate)) fe.subscriptionStartDate = 'Укажите корректную дату начала';
  if (!isIsoDate(body.subscriptionEndDate)) fe.subscriptionEndDate = 'Укажите корректную дату окончания';
  if (!fe.subscriptionStartDate && !fe.subscriptionEndDate && body.subscriptionEndDate! < body.subscriptionStartDate!) {
    fe.subscriptionEndDate = 'Дата окончания не может быть раньше даты начала';
  }
  const discount = body.discount ?? NO_DISCOUNT;
  if (discount.type !== 'AMOUNT' && discount.type !== 'PERCENT') fe.discountType = 'Выберите тип скидки';
  else if (typeof discount.value !== 'number' || Number.isNaN(discount.value) || discount.value < 0)
    fe.discountValue = 'Скидка не может быть отрицательной';
  else if (discount.type === 'PERCENT' && discount.value > 100) fe.discountValue = 'Скидка в процентах — не больше 100';
  for (const m of body.moduleOverrides ?? []) {
    const def = MODULES.find((d) => d.code === m.code);
    if (!def) fe[`moduleOverrides.${m.code}`] = 'Неизвестный модуль';
    else if (def.system && m.value !== null) fe[`moduleOverrides.${m.code}`] = 'Системный модуль нельзя переопределить';
    else if (m.expiresAt && (Number.isNaN(Date.parse(m.expiresAt)) || Date.parse(m.expiresAt) <= Date.now()))
      fe[`moduleExpirations.${m.code}`] = 'Срок действия модуля должен быть в будущем';
  }
  return fe;
}

/** Валидация формы конструктора тарифов; лимиты — в диапазонах справочника. */
function validateTariff(body: Partial<TariffPlanPayload>, selfId?: string): Record<string, string> {
  const fe: Record<string, string> = {};
  const tariffs = load().tariffs.filter((t) => t.id !== selfId);
  const name = (body.name ?? '').trim();
  const code = (body.code ?? '').trim();
  if (name.length < 2 || name.length > 60) fe.name = 'Название — от 2 до 60 символов';
  else if (tariffs.some((t) => t.name.toLowerCase() === name.toLowerCase())) fe.name = 'Тариф с таким названием уже существует';
  if (!/^[a-z][a-z0-9_-]{1,39}$/.test(code)) fe.code = 'Латиница в нижнем регистре, цифры, «-» и «_», от 2 символов';
  else if (tariffs.some((t) => t.code === code)) fe.code = 'Этот системный код уже используется';
  if (typeof body.annualPrice !== 'number' || !Number.isFinite(body.annualPrice) || body.annualPrice < 0)
    fe.annualPrice = 'Укажите годовую цену';
  for (const l of LIMITS) {
    const v = body.limits?.[l.code];
    if (typeof v !== 'number' || Number.isNaN(v)) fe[`limits.${l.code}`] = 'Введите число';
    else if (l.type === 'integer' && !Number.isInteger(v)) fe[`limits.${l.code}`] = 'Введите целое число';
    else if (v < l.min || v > l.max) fe[`limits.${l.code}`] = `Значение должно быть от ${l.min} до ${l.max}`;
  }
  return fe;
}

function toTariffRecord(body: TariffPlanPayload, id: string, policies: TariffRecord['overridePolicies']): TariffRecord {
  return {
    id,
    code: body.code.trim(),
    name: body.name.trim(),
    description: body.description?.trim() ?? '',
    annualPrice: body.annualPrice,
    // Системные модули включены в любой тариф
    modules: Object.fromEntries(MODULES.map((m) => [m.code, Boolean(m.system || body.modules?.[m.code])])),
    limits: Object.fromEntries(LIMITS.map((l) => [l.code, body.limits[l.code]!])),
    overridePolicies: policies,
  };
}

const nextDay = (d: string) => dayjs(d).add(1, 'day').format('YYYY-MM-DD');

/**
 * Автоматическое логирование истории подписки. Смена тарифа и продление фиксируют актуальные условия
 * тарифа (цена, лимиты) — изменения шаблона не затрагивают уже оформленные периоды.
 * В истории всегда одна запись «Активен», предыдущие переходят в «Завершён».
 */
export function recordSubscriptionChange(before: OrgRecord | null, next: OrgRecord, source: ChangeSource) {
  let operation: SubscriptionOperation | null;
  if (!before) operation = 'ACTIVATION';
  else if (before.tariffPlanId !== next.tariffPlanId) operation = 'TARIFF_CHANGE';
  else if (next.subscriptionEndDate > before.subscriptionEndDate) operation = 'RENEWAL';
  else if (
    before.subscriptionStartDate !== next.subscriptionStartDate ||
    before.subscriptionEndDate !== next.subscriptionEndDate ||
    JSON.stringify(before.discount) !== JSON.stringify(next.discount)
  )
    operation = 'UPDATE';
  else operation = null;
  if (!operation) return;

  const tariff = findTariff(next.tariffPlanId)!;
  if (operation !== 'UPDATE') {
    next.annualPrice = tariff.annualPrice;
    next.limits = { ...tariff.limits };
  }
  const active = next.history.find((h) => h.status === 'ACTIVE');
  let periodStart = next.subscriptionStartDate;
  if (before && operation === 'RENEWAL' && before.subscriptionEndDate >= next.subscriptionStartDate)
    periodStart = nextDay(before.subscriptionEndDate);
  if (operation === 'UPDATE' && active && active.periodStart > periodStart) periodStart = active.periodStart;

  const entry: SubscriptionHistoryEntry = {
    id: crypto.randomUUID(),
    operation,
    operationAt: new Date().toISOString(),
    tariffName: tariff.name,
    periodStart,
    periodEnd: next.subscriptionEndDate,
    basePrice: next.annualPrice,
    discount: next.discount,
    finalPrice: finalPrice(next.annualPrice, next.discount),
    status: 'ACTIVE',
    source,
  };
  next.history = [entry, ...next.history.map((h) => ({ ...h, status: 'COMPLETED' as const }))];
}

/**
 * Фоновый сервис (cron worker): модули, включённые сверх тарифа со сроком действия,
 * переводятся в OFF при наступлении даты и времени окончания доступа.
 */
export function runModuleExpirations(now = Date.now()) {
  const db = load();
  let changed = false;
  db.organizations.forEach((org, idx) => {
    const expired = Object.entries(org.moduleExpirations ?? {}).filter(([, at]) => at && Date.parse(at) <= now);
    if (!expired.length) return;
    const before = structuredClone(org);
    const next: OrgRecord = {
      ...org,
      moduleOverrides: { ...org.moduleOverrides },
      moduleExpirations: { ...org.moduleExpirations },
      updatedAt: new Date(now).toISOString(),
      updatedBy: 'SYSTEM_SCHEDULER',
      version: org.version + 1,
    };
    expired.forEach(([code]) => {
      next.moduleOverrides[code] = null;
      next.moduleExpirations[code] = null;
    });
    db.organizations[idx] = next;
    changed = true;
    queueMicrotask(() => publishChanges(before, next));
  });
  if (changed) save(db);
}

/**
 * «Backend» после атомарного обновления публикует события для активных сессий tenant.
 * События не содержат конфигурацию — только что изменилось; данные клиент запрашивает сам.
 */
export function publishChanges(before: OrgRecord, after: OrgRecord) {
  const changed: ChangedArea[] = [];
  if (before.tariffPlanId !== after.tariffPlanId) changed.push('tariff');
  if (
    before.subscriptionEnabled !== after.subscriptionEnabled ||
    before.subscriptionStartDate !== after.subscriptionStartDate ||
    before.subscriptionEndDate !== after.subscriptionEndDate
  )
    changed.push('subscription');
  const modsBefore = effectiveModules(before);
  const modsAfter = effectiveModules(after);
  if (modsBefore.join() !== modsAfter.join()) changed.push('modules');
  if (JSON.stringify(effectiveLimitValues(before)) !== JSON.stringify(effectiveLimitValues(after)))
    changed.push('limits');
  if (!changed.length) return;

  const base = { tenantId: after.tenantId, version: after.version, changed, occurredAt: new Date().toISOString() };
  const emit = (type: TenantEvent['type'], extra: Partial<TenantEvent> = {}) => publish({ ...base, type, ...extra });

  emit('tenant-config.updated');
  if (changed.includes('tariff') || changed.includes('subscription')) emit('subscription.updated');
  const disabled = modsBefore.filter((m) => !modsAfter.includes(m));
  if (disabled.length) emit('module.disabled', { modules: disabled });
  if (changed.includes('limits')) emit('limits.updated');
  const statusBefore = computeStatus(before);
  const statusAfter = computeStatus(after);
  if (statusAfter !== statusBefore && statusAfter === 'BLOCKED') emit('subscription.blocked');
  if (statusAfter !== statusBefore && statusAfter === 'EXPIRED') emit('subscription.expired');
}

/** Контекст tenant-запроса: сессия, принадлежность организации. */
export function tenantContext(request: Request): { org: OrgRecord; user: CurrentUser } | Response {
  const session = getSession();
  if (!session) return err(401, 'UNAUTHORIZED');
  // Права не кэшируются в сессии: пересчёт из текущей матрицы роли и тарифа на каждый запрос
  const record = loadUsers().find((u) => u.id === session.id);
  const user = record ? toCurrentUser(record, session, session.roles) : session;
  if (user.clientSlug && isDeactivated(user.id, user.clientSlug)) return err(403, 'FORBIDDEN', 'Учётная запись деактивирована.');
  const slug = new URL(request.url).searchParams.get('clientSlug');
  if (user.role !== 'SUPERADMIN' && user.clientSlug !== slug) return err(403, 'FORBIDDEN');
  const org = load().organizations.find((o) => o.clientSlug === slug);
  if (!org) return err(404, 'NOT_FOUND');
  return { org, user };
}

export function subscriptionGuard(org: OrgRecord): Response | null {
  const status = computeStatus(org);
  if (status === 'BLOCKED') return err(403, 'TENANT_BLOCKED');
  if (status === 'EXPIRED') return err(403, 'SUBSCRIPTION_EXPIRED');
  return null;
}

const canManageOrganization = (u: CurrentUser) =>
  u.role === 'SUPERADMIN' || u.permissions.includes('organization.manage');


/** Контекст конструктора курса: модуль «Курсы» включён, право на просмотр; редактирование — courses.manage */
function courseContext(request: Request, courseId: string, edit = false) {
  const ctx = tenantContext(request);
  if (ctx instanceof Response) return ctx;
  const blocked = subscriptionGuard(ctx.org);
  if (blocked) return blocked;
  if (!effectiveModules(ctx.org).includes('COURSES')) return err(403, 'MODULE_DISABLED');
  if (!ctx.user.permissions.includes('courses.view')) return err(403, 'FORBIDDEN');
  const course = findCourse(ctx.org, courseId);
  if (!course) return err(404, 'NOT_FOUND', 'Курс не найден.');
  // Структура курса — опция «Управление учебной программой → Редактирование» итогового доступа
  const canEdit = ctx.user.access.includes('lms_prog_core.edit');
  if (edit && !canEdit) return err(403, 'FORBIDDEN', 'Недостаточно прав для изменения курса.');
  return { ...ctx, course, canEdit };
}

type CourseCtx = Exclude<ReturnType<typeof courseContext>, Response>;

function courseContent(ctx: CourseCtx) {
  const modules = getStructure(ctx.course.id);
  const access = ctx.user.access;
  // Элементы без права просмотра типа не отдаются; скрытые — только редактору структуры
  const visible = modules.map((m) => ({
    ...m,
    days: m.days.map((d) => ({
      ...d,
      elements: d.elements.filter((e) => canElement(access, e.type, 'view') && (ctx.canEdit || !e.hidden)),
    })),
  }));
  const elementAccess = Object.fromEntries(
    ELEMENT_TYPES.map((t) => [t, (['create', 'edit', 'delete', 'view'] as const).filter((a) => canElement(access, t, a))]),
  );
  return {
    course: findCourse(ctx.org, ctx.course.id)!,
    canEdit: ctx.canEdit,
    canDeleteCourse: access.includes('lms_prog_core.delete'),
    elementAccess,
    modules: visible,
  };
}

/** После изменения структуры: курс помечается обновлённым */
function afterStructureChange(ctx: CourseCtx) {
  touchCourse(ctx.org, ctx.course.id, {});
  return HttpResponse.json(courseContent(ctx));
}

const titleOf = (v: unknown, fallback: string) => {
  const t = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  return t ? t.slice(0, 255) : fallback;
};


// ---------- Глобальные роли ----------

const ROLE_CODE = /^[a-z][a-z0-9_]{1,39}$/;

/** Назначения роли в существующих организациях: системной — по роли платформы, кастомной — по коду */
function assignmentsOf(role: GlobalRoleRecord, users: UserRecord[] = loadUsers()) {
  const orgSlugs = new Set(load().organizations.map((o) => o.clientSlug));
  return users.flatMap((u) =>
    u.roles
      .filter((r) =>
        role.isSystem ? r.role === role.systemRole : r.role === 'CUSTOM' && r.customRole === role.code,
      )
      .filter((r) => !r.clientSlug || orgSlugs.has(r.clientSlug))
      .map((r) => ({ user: u, clientSlug: r.clientSlug })),
  );
}

const toGlobalRole = (r: GlobalRoleRecord, users?: UserRecord[]) => ({
  ...r,
  usersCount: new Set(assignmentsOf(r, users).map((a) => a.user.id)).size,
});

function validateRole(body: Partial<GlobalRolePayload>, roles: GlobalRoleRecord[], selfId?: string): Record<string, string> {
  const fe: Record<string, string> = {};
  const name = (body.name ?? '').trim();
  const code = (body.code ?? '').trim();
  if (name.length < 2 || name.length > 60) fe.name = 'Название — от 2 до 60 символов';
  else if (roles.some((r) => r.id !== selfId && r.name.toLowerCase() === name.toLowerCase()))
    fe.name = 'Роль с таким названием уже существует';
  if (!selfId) {
    if (!ROLE_CODE.test(code)) fe.code = 'Латиница в нижнем регистре, цифры и «_», от 2 до 40 символов';
    else if (roles.some((r) => r.code === code)) fe.code = 'Роль с таким кодом уже существует';
  }
  if ((body.description ?? '').length > 500) fe.description = 'Не более 500 символов';
  return fe;
}

/** Изменение матрицы роли: сброс кэша прав — событие для организаций, где у роли есть пользователи */
function publishPermissionsChanged(role: GlobalRoleRecord) {
  const slugs = new Set(assignmentsOf(role).map((a) => a.clientSlug));
  const orgs = load().organizations.filter((o) => (role.systemRole === 'SUPERADMIN' ? false : slugs.has(o.clientSlug)));
  for (const org of orgs)
    publish({
      type: 'permissions.updated',
      tenantId: org.tenantId,
      version: org.version,
      changed: ['permissions'],
      occurredAt: new Date().toISOString(),
    });
}


// ---------- Локальные роли компаний ----------

function pageOf(url: URL) {
  const size = Number(url.searchParams.get('pageSize'));
  return {
    page: Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1),
    pageSize: [10, 20, 50, 100].includes(size) ? size : 20,
  };
}


/** Что компания может делегировать: глобальная роль «Администратор организации» ∩ текущий тариф */
const delegableOptions = (org: OrgRecord) => accessFor({ role: 'ORGANIZATION_ADMIN', clientSlug: org.clientSlug });

/** Действия создания, ограниченные лимитом. */
const CREATE_ACTIONS: Record<string, { label: string; limitCode: string; permission: string }> = {
  COURSES: { label: 'Создать курс', limitCode: 'COURSES_COUNT', permission: 'courses.manage' },
};

/** Роли, доступные для входа: роли заблокированных организаций и организаций с истёкшей подпиской исключаются. */
/** Название кастомной роли для отображения в назначении */
const withRoleName = <T extends { role: Role; customRole?: string }>(r: T): T & { roleName?: string } =>
  r.role === 'CUSTOM' ? { ...r, roleName: findCustomRole(r.customRole)?.name } : r;

function activeRoles(user: UserRecord): RoleAssignment[] {
  const orgs = load().organizations;
  return user.roles.flatMap((r) => {
    if (!r.clientSlug) return [withRoleName(r)];
    const org = orgs.find((o) => o.clientSlug === r.clientSlug);
    if (!org || isDeactivated(user.id, org.clientSlug)) return [];
    // Администратор входит и при истёкшей подписке — чтобы её оплатить
    const status = computeStatus(org);
    const allowed = status === 'ACTIVE' || (status === 'EXPIRED' && r.role === 'ORGANIZATION_ADMIN');
    return allowed ? [{ ...withRoleName(r), organizationName: org.name }] : [];
  });
}

function lockedError(lockedUntil: string, now: number) {
  const minutes = Math.max(1, Math.ceil((Date.parse(lockedUntil) - now) / 60_000));
  return err(
    423,
    'ACCOUNT_LOCKED',
    `Аккаунт временно заблокирован после ${MAX_FAILED_ATTEMPTS} неверных попыток ввода пароля. Повторите через ${minutes} мин.`,
  );
}

/** Раздел «Пользователи»: Суперадминистратор или роль этой организации с нужной опцией в итоговом доступе. */
function requireUsersManager(slug: string, option = 'lms_users.list_view'): Response | null {
  const session = getSession();
  if (!session) return err(401, 'UNAUTHORIZED');
  if (!load().organizations.some((o) => o.clientSlug === slug)) return err(404, 'NOT_FOUND');
  if (session.role === 'SUPERADMIN') return null;
  if (session.clientSlug === slug && accessFor(session).includes(option)) return null;
  return err(403, 'FORBIDDEN');
}

const toOrganizationUser = (u: UserRecord, slug: string): OrganizationUser => ({
  id: u.id,
  fullName: fullNameOf(u),
  iin: u.iin,
  email: u.email,
  roles: u.roles.filter((r) => r.clientSlug === slug).map((r): Role => r.role),
  customRoles: u.roles
    .filter((r) => r.clientSlug === slug && r.role === 'CUSTOM')
    .map((r) => findCustomRole(r.customRole)?.name ?? r.customRole ?? ''),
});

function toPlatformUser(u: UserRecord) {
  const orgs = load().organizations;
  return {
    id: u.id,
    fullName: fullNameOf(u),
    lastName: u.lastName,
    firstName: u.firstName,
    middleName: u.middleName,
    iin: u.iin,
    email: u.email,
    phone: u.phone,
    region: u.region,
    roles: u.roles.map((r) => ({ ...withRoleName(r), organizationName: orgs.find((o) => o.clientSlug === r.clientSlug)?.name })),
  };
}

/** Те же правила, что и при регистрации; уникальность ИИН и email — без учёта редактируемого пользователя. */
export function validateUserProfile(
  body: Partial<PlatformUserPayload>,
  users: UserRecord[],
  opts: { passwordRequired: boolean; selfId?: string },
): Record<string, string> {
  const others = users.filter((u) => u.id !== opts.selfId);
  const iin = (body.iin ?? '').trim();
  const email = (body.email ?? '').trim();
  const fe: Record<string, string> = {};
  if (!isValidIin(iin)) fe.iin = MESSAGES.iin;
  else if (others.some((u) => u.iin === iin)) fe.iin = 'Пользователь с таким ИИН уже зарегистрирован';
  if (!body.lastName?.trim()) fe.lastName = MESSAGES.lastName;
  if (!body.firstName?.trim()) fe.firstName = MESSAGES.firstName;
  if (!REGIONS.some((r) => r.name === body.region)) fe.region = MESSAGES.region;
  if (!isValidKzPhone(body.phone ?? '')) fe.phone = MESSAGES.phone;
  if (!EMAIL_PATTERN.test(email)) fe.email = MESSAGES.email;
  else if (others.some((u) => u.email.toLowerCase() === email.toLowerCase()))
    fe.email = 'Пользователь с таким email уже зарегистрирован';
  if ((opts.passwordRequired || body.password) && !isValidPassword(body.password ?? '')) fe.password = MESSAGES.password;
  return fe;
}

export const profileFields = (body: Partial<PlatformUserPayload>) => ({
  iin: body.iin!.trim(),
  lastName: body.lastName!.trim(),
  firstName: body.firstName!.trim(),
  middleName: body.middleName?.trim() || undefined,
  region: body.region!,
  phone: phoneDigits(body.phone!),
  email: body.email!.trim(),
});

const sseDisabled = () => {
  try {
    return localStorage.getItem('mock.sseDisabled') === '1';
  } catch {
    return false;
  }
};

export const handlers: HttpHandler[] = [
  // ---------- Auth ----------
  http.get('/api/auth/me', async () => {
    await latency();
    const session = getSession();
    const record = session && loadUsers().find((u) => u.id === session.id);
    if (!session || !record) return err(401, 'UNAUTHORIZED');
    return HttpResponse.json(toCurrentUser(record, session, activeRoles(record)));
  }),
  http.get('/api/dictionaries/regions', async () => {
    await latency();
    return HttpResponse.json(REGIONS);
  }),
  // Шаг 1 входа: поиск ИИН в базе
  http.post('/api/auth/check-iin', async ({ request }) => {
    await latency();
    const { iin = '' } = (await request.json()) as { iin?: string };
    if (!loadUsers().some((u) => u.iin === iin.trim())) return err(404, 'USER_NOT_FOUND');
    return HttpResponse.json({ exists: true });
  }),
  // Шаг 2 входа: пароль, защита от подбора, статус организаций, маршрутизация по ролям
  http.post('/api/auth/login', async ({ request }) => {
    await latency();
    const { iin = '', password = '' } = (await request.json()) as { iin?: string; password?: string };
    const users = loadUsers();
    const user = users.find((u) => u.iin === iin.trim());
    if (!user) return err(404, 'USER_NOT_FOUND');

    const now = Date.now();
    if (user.lockedUntil && Date.parse(user.lockedUntil) > now) return lockedError(user.lockedUntil, now);
    if (user.passwordHash !== hashPassword(password)) {
      user.failedAttempts += 1;
      if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        user.failedAttempts = 0;
        user.lockedUntil = new Date(now + LOCK_MINUTES * 60_000).toISOString();
        saveUsers(users);
        return lockedError(user.lockedUntil, now);
      }
      saveUsers(users);
      return err(401, 'INVALID_CREDENTIALS');
    }
    user.failedAttempts = 0;
    user.lockedUntil = undefined;
    saveUsers(users);

    const roles = activeRoles(user);
    if (!roles.length) return err(403, 'ORGANIZATION_UNAVAILABLE');
    // Несколько ролей — кабинет с наивысшими правами
    const active = [...roles].sort((x, y) => ROLE_PRIORITY.indexOf(x.role) - ROLE_PRIORITY.indexOf(y.role))[0]!;
    const current = toCurrentUser(user, active, roles);
    setSession(current);
    return HttpResponse.json(current);
  }),
  http.post('/api/auth/register', async ({ request }) => {
    await latency();
    const body = (await request.json()) as Partial<RegisterPayload>;
    const users = loadUsers();
    const iin = (body.iin ?? '').trim();
    const email = (body.email ?? '').trim();
    const fe: Record<string, string> = {};
    if (!isValidIin(iin)) fe.iin = MESSAGES.iin;
    else if (users.some((u) => u.iin === iin)) fe.iin = 'Пользователь с таким ИИН уже зарегистрирован';
    if (!body.lastName?.trim()) fe.lastName = MESSAGES.lastName;
    if (!body.firstName?.trim()) fe.firstName = MESSAGES.firstName;
    if (!REGIONS.some((r) => r.name === body.region)) fe.region = MESSAGES.region;
    if (!isValidKzPhone(body.phone ?? '')) fe.phone = MESSAGES.phone;
    if (!EMAIL_PATTERN.test(email)) fe.email = MESSAGES.email;
    else if (users.some((u) => u.email.toLowerCase() === email.toLowerCase()))
      fe.email = 'Пользователь с таким email уже зарегистрирован';
    if (!isValidPassword(body.password ?? '')) fe.password = MESSAGES.password;
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);

    const user: UserRecord = {
      id: crypto.randomUUID(),
      iin,
      lastName: body.lastName!.trim(),
      firstName: body.firstName!.trim(),
      middleName: body.middleName?.trim() || undefined,
      region: body.region!,
      phone: phoneDigits(body.phone!),
      email,
      passwordHash: hashPassword(body.password!),
      // Базовая роль «Слушатель» присваивается автоматически
      roles: [{ role: 'LEARNER' }],
      failedAttempts: 0,
    };
    saveUsers([...users, user]);
    const current = toCurrentUser(user, { role: 'LEARNER' });
    setSession(current);
    return HttpResponse.json(current, { status: 201 });
  }),
  http.post('/api/auth/switch-role', async ({ request }) => {
    await latency();
    const session = getSession();
    const record = session && loadUsers().find((u) => u.id === session.id);
    if (!session || !record) return err(401, 'UNAUTHORIZED');
    const target = (await request.json()) as Pick<RoleAssignment, 'role' | 'clientSlug'>;
    const roles = activeRoles(record);
    const role = roles.find((r) => sameAssignment(r, target));
    if (!role) return err(403, 'FORBIDDEN');
    const current = toCurrentUser(record, role, roles);
    setSession(current);
    return HttpResponse.json(current);
  }),
  // Профиль: личные данные и аватар. Сохранение завершает приветственный экран первого входа.
  http.put('/api/auth/profile', async ({ request }) => {
    await latency();
    const session = getSession();
    const users = loadUsers();
    const user = session && users.find((u) => u.id === session.id);
    if (!session || !user) return err(401, 'UNAUTHORIZED');
    const body = (await request.json().catch(() => ({}))) as Partial<ProfilePayload>;
    const email = (body.email ?? '').trim();
    const fe: Record<string, string> = {};
    if (!body.lastName?.trim()) fe.lastName = MESSAGES.lastName;
    if (!body.firstName?.trim()) fe.firstName = MESSAGES.firstName;
    if (!isValidKzPhone(body.phone ?? '')) fe.phone = MESSAGES.phone;
    if (!EMAIL_PATTERN.test(email)) fe.email = MESSAGES.email;
    else if (users.some((u) => u.id !== user.id && u.email.toLowerCase() === email.toLowerCase()))
      fe.email = 'Пользователь с таким email уже зарегистрирован';
    if (body.region !== undefined && !REGIONS.some((r) => r.name === body.region)) fe.region = MESSAGES.region;
    if (typeof body.avatar === 'string' && (!body.avatar.startsWith('data:image/') || body.avatar.length > 700_000))
      fe.avatar = 'Изображение до 500 КБ';
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);
    Object.assign(user, {
      lastName: body.lastName!.trim(),
      firstName: body.firstName!.trim(),
      middleName: body.middleName?.trim() || undefined,
      phone: phoneDigits(body.phone!),
      email,
      region: body.region ?? user.region,
      profileCompleted: true,
    });
    if (body.avatar !== undefined) user.avatar = body.avatar ?? undefined;
    saveUsers(users);
    const current = toCurrentUser(user, session, activeRoles(user));
    setSession(current);
    return HttpResponse.json(current);
  }),
  http.post('/api/auth/password', async ({ request }) => {
    await latency();
    const session = getSession();
    const users = loadUsers();
    const user = session && users.find((u) => u.id === session.id);
    if (!session || !user) return err(401, 'UNAUTHORIZED');
    const { currentPassword = '', newPassword = '' } = (await request.json().catch(() => ({}))) as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (user.passwordHash !== hashPassword(currentPassword))
      return err(400, 'VALIDATION_ERROR', 'Проверьте пароль.', { currentPassword: 'Неверный текущий пароль' });
    if (!isValidPassword(newPassword)) return err(400, 'VALIDATION_ERROR', 'Проверьте пароль.', { newPassword: MESSAGES.password });
    if (newPassword === currentPassword)
      return err(400, 'VALIDATION_ERROR', 'Проверьте пароль.', { newPassword: 'Новый пароль совпадает с текущим' });
    user.passwordHash = hashPassword(newPassword);
    saveUsers(users);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post('/api/auth/logout', async () => {
    setSession(null);
    return new HttpResponse(null, { status: 204 });
  }),

  // ---------- Пользователи организации ----------
  http.get('/api/organizations/:slug/users', async ({ params }) => {
    await latency();
    const slug = String(params.slug);
    const denied = requireUsersManager(slug);
    if (denied) return denied;
    return HttpResponse.json(
      loadUsers()
        .filter((u) => u.roles.some((r) => r.clientSlug === slug))
        .map((u) => toOrganizationUser(u, slug)),
    );
  }),
  http.get('/api/organizations/:slug/assignable-roles', async ({ params }) => {
    await latency();
    const denied = requireUsersManager(String(params.slug), 'lms_users.assign_roles');
    if (denied) return denied;
    return HttpResponse.json([
      { value: 'ORGANIZATION_ADMIN', label: 'Администратор организации' },
      { value: 'TRAINER', label: 'Тренер' },
      ...loadRoles()
        .filter((r) => !r.isSystem)
        .map((r) => ({ value: `custom:${r.code}`, label: r.name })),
    ]);
  }),
  http.post('/api/organizations/:slug/users/roles', async ({ params, request }) => {
    await latency();
    const slug = String(params.slug);
    const denied = requireUsersManager(slug, 'lms_users.assign_roles');
    if (denied) return denied;
    const { iin = '', role } = (await request.json()) as { iin?: string; role?: AssignableRole };
    const customCode = typeof role === 'string' && role.startsWith('custom:') ? role.slice(7) : undefined;
    if (role !== 'ORGANIZATION_ADMIN' && role !== 'TRAINER' && !findCustomRole(customCode))
      return err(400, 'VALIDATION_ERROR', undefined, { role: 'Выберите роль' });
    const assignment = customCode
      ? { role: 'CUSTOM' as const, customRole: customCode, clientSlug: slug }
      : { role: role as 'ORGANIZATION_ADMIN' | 'TRAINER', clientSlug: slug };
    const users = loadUsers();
    const user = users.find((u) => u.iin === iin.trim());
    if (!user) return err(400, 'VALIDATION_ERROR', undefined, { iin: 'Пользователь с таким ИИН не найден' });
    if (user.roles.some((r) => sameAssignment(r, assignment)))
      return err(400, 'VALIDATION_ERROR', undefined, { role: 'У пользователя уже есть эта роль в организации' });
    user.roles.push(assignment);
    saveUsers(users);
    return HttpResponse.json(toOrganizationUser(user, slug));
  }),

  // ---------- Суперадмин: пользователи и лимиты платформы ----------
  http.get('/api/superadmin/users', async ({ request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const search = (new URL(request.url).searchParams.get('search') ?? '').trim().toLowerCase();
    return HttpResponse.json(
      loadUsers()
        .filter((u) => !search || fullNameOf(u).toLowerCase().includes(search) || u.iin.includes(search) || u.email.toLowerCase().includes(search))
        .map(toPlatformUser),
    );
  }),
  http.post('/api/superadmin/users', async ({ request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const body = (await request.json()) as Partial<PlatformUserPayload>;
    const users = loadUsers();
    const fe = validateUserProfile(body, users, { passwordRequired: true });
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);
    const user: UserRecord = {
      id: crypto.randomUUID(),
      ...profileFields(body),
      passwordHash: hashPassword(body.password!),
      // Как и при регистрации, присваивается базовая роль «Слушатель»
      roles: [{ role: 'LEARNER' }],
      profileCompleted: false,
      failedAttempts: 0,
    };
    saveUsers([...users, user]);
    return HttpResponse.json(toPlatformUser(user), { status: 201 });
  }),
  http.put('/api/superadmin/users/:id', async ({ params, request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const users = loadUsers();
    const user = users.find((u) => u.id === params.id);
    if (!user) return err(404, 'NOT_FOUND');
    const body = (await request.json()) as Partial<PlatformUserPayload>;
    const fe = validateUserProfile(body, users, { passwordRequired: false, selfId: user.id });
    const roles = body.roles ?? user.roles;
    // Через редактирование роли можно только снять; назначение — отдельным действием
    if (roles.some((r) => !user.roles.some((x) => sameAssignment(x, r)))) fe.roles = 'Новые роли назначаются через «Назначить роль»';
    if (user.id === getSession()!.id && !roles.some((r) => r.role === 'SUPERADMIN'))
      fe.roles = 'Нельзя снять роль суперадминистратора с собственной учётной записи';
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);
    Object.assign(user, profileFields(body), {
      roles: user.roles.filter((x) => roles.some((r) => sameAssignment(x, r))),
    });
    if (body.password) {
      user.passwordHash = hashPassword(body.password);
      user.failedAttempts = 0;
      user.lockedUntil = undefined;
    }
    saveUsers(users);
    return HttpResponse.json(toPlatformUser(user));
  }),
  http.delete('/api/superadmin/users/:id', async ({ params }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const users = loadUsers();
    if (!users.some((u) => u.id === params.id)) return err(404, 'NOT_FOUND');
    if (params.id === getSession()!.id) return err(400, 'VALIDATION_ERROR', 'Нельзя удалить собственную учётную запись');
    saveUsers(users.filter((u) => u.id !== params.id));
    return new HttpResponse(null, { status: 204 });
  }),

  // ---------- Superadmin ----------
  http.get('/api/superadmin/organizations', async ({ request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const url = new URL(request.url);
    const search = (url.searchParams.get('search') ?? '').trim().toLowerCase();
    const status = url.searchParams.get('status') ?? '';
    const tariffPlanId = url.searchParams.get('tariffPlanId') ?? '';
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
    const pageSize = [10, 20, 50, 100].includes(Number(url.searchParams.get('pageSize')))
      ? Number(url.searchParams.get('pageSize'))
      : 20;

    const filtered = load()
      .organizations.filter(
        (o) => !search || o.name.toLowerCase().includes(search) || o.clientSlug.toLowerCase().includes(search),
      )
      .filter((o) => !status || computeStatus(o) === status)
      .filter((o) => !tariffPlanId || o.tariffPlanId === tariffPlanId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return HttpResponse.json({
      items: filtered.slice((page - 1) * pageSize, page * pageSize).map(toListItem),
      total: filtered.length,
      page,
      pageSize,
    });
  }),

  http.get('/api/superadmin/organizations/slug-availability', async ({ request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const slug = new URL(request.url).searchParams.get('slug') ?? '';
    const taken = RESERVED_SLUGS.includes(slug) || load().organizations.some((o) => o.clientSlug === slug);
    return HttpResponse.json({ available: !taken && SLUG_PATTERN.test(slug) });
  }),

  http.post('/api/superadmin/organizations', async ({ request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const body = (await request.json()) as Partial<CreateOrganizationPayload>;
    const db = load();
    const fe: Record<string, string> = {};
    const name = (body.name ?? '').trim();
    const slug = (body.clientSlug ?? '').trim();
    if (name.length < 2 || name.length > 120) fe.name = 'Название — от 2 до 120 символов';
    else if (db.organizations.some((o) => o.name.toLowerCase() === name.toLowerCase()))
      fe.name = 'Организация с таким названием уже существует';
    const slugErr = slugError(slug);
    if (slugErr) fe.clientSlug = slugErr;
    else if (db.organizations.some((o) => o.clientSlug === slug)) fe.clientSlug = 'Этот адрес уже занят';
    Object.assign(
      fe,
      validateSettings({ ...body, moduleOverrides: [], discount: NO_DISCOUNT } as Partial<SubscriptionSettingsPayload>),
    );
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', undefined, fe);

    const now = new Date().toISOString();
    const tariff = findTariff(body.tariffPlanId!)!;
    const org: OrgRecord = {
      tenantId: crypto.randomUUID(),
      name,
      clientSlug: slug,
      tariffPlanId: tariff.id,
      subscriptionEnabled: Boolean(body.subscriptionEnabled),
      subscriptionStartDate: body.subscriptionStartDate!,
      subscriptionEndDate: body.subscriptionEndDate!,
      moduleOverrides: {},
      moduleExpirations: {},
      annualPrice: tariff.annualPrice,
      limits: { ...tariff.limits },
      discount: NO_DISCOUNT,
      history: [],
      createdAt: now,
      updatedAt: now,
      updatedBy: 'SUPERADMIN',
      version: 1,
      usage: { USERS_COUNT: 0, COURSES_COUNT: 0, STORAGE_GB: 0 },
    };
    recordSubscriptionChange(null, org, 'SUPERADMIN');
    db.organizations.push(org);
    save(db);
    return HttpResponse.json(toDetail(org), { status: 201 });
  }),

  http.get('/api/superadmin/organizations/:tenantId', async ({ params }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const org = load().organizations.find((o) => o.tenantId === params.tenantId);
    return org ? HttpResponse.json(toDetail(org)) : err(404, 'NOT_FOUND');
  }),

  // Название и адрес кабинета; условия подписки меняются отдельно (version не увеличивается)
  http.patch('/api/superadmin/organizations/:tenantId', async ({ params, request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const db = load();
    const org = db.organizations.find((o) => o.tenantId === params.tenantId);
    if (!org) return err(404, 'NOT_FOUND');
    const body = (await request.json()) as Partial<OrganizationProfilePayload>;
    const name = (body.name ?? '').trim();
    const slug = (body.clientSlug ?? '').trim();
    const others = db.organizations.filter((o) => o.tenantId !== org.tenantId);
    const fe: Record<string, string> = {};
    if (name.length < 2 || name.length > 120) fe.name = 'Название — от 2 до 120 символов';
    else if (others.some((o) => o.name.toLowerCase() === name.toLowerCase()))
      fe.name = 'Организация с таким названием уже существует';
    const slugErr = slug === org.clientSlug ? null : slugError(slug);
    if (slugErr) fe.clientSlug = slugErr;
    else if (others.some((o) => o.clientSlug === slug)) fe.clientSlug = 'Этот адрес уже занят';
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', undefined, fe);

    const oldSlug = org.clientSlug;
    org.name = name;
    org.clientSlug = slug;
    org.updatedAt = new Date().toISOString();
    org.updatedBy = 'SUPERADMIN';
    save(db);
    // Роли пользователей привязаны к адресу кабинета
    if (oldSlug !== slug) {
      const users = loadUsers();
      users.forEach((u) => u.roles.forEach((r) => r.clientSlug === oldSlug && (r.clientSlug = slug)));
      saveUsers(users);
    }
    return HttpResponse.json(toDetail(org));
  }),

  // Удаление организации: запись, роли пользователей в ней и контент кабинета
  http.delete('/api/superadmin/organizations/:tenantId', async ({ params }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const db = load();
    const org = db.organizations.find((o) => o.tenantId === params.tenantId);
    if (!org) return err(404, 'NOT_FOUND');
    db.organizations = db.organizations.filter((o) => o.tenantId !== org.tenantId);
    save(db);
    const users = loadUsers();
    users.forEach((u) => (u.roles = u.roles.filter((r) => r.clientSlug !== org.clientSlug)));
    saveUsers(users);
    removeContent(org.tenantId);
    removeCourseContentOf(`${org.tenantId}-`);
    removeStructure(org.tenantId);
    // Открытые кабинеты организации сразу теряют доступ
    publish({
      type: 'subscription.blocked',
      tenantId: org.tenantId,
      version: org.version + 1,
      changed: ['subscription'],
      occurredAt: new Date().toISOString(),
    });
    return new HttpResponse(null, { status: 204 });
  }),

  http.patch('/api/superadmin/organizations/:tenantId/subscription-settings', async ({ params, request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const db = load();
    const idx = db.organizations.findIndex((o) => o.tenantId === params.tenantId);
    if (idx < 0) return err(404, 'NOT_FOUND');
    const current = db.organizations[idx]!;
    const body = (await request.json()) as Partial<SubscriptionSettingsPayload>;

    if (body.version !== current.version) return err(409, 'CONFLICT');
    const fieldErrors = validateSettings(body);
    if (Object.keys(fieldErrors).length) return err(400, 'VALIDATION_ERROR', undefined, fieldErrors);

    const tariff = findTariff(body.tariffPlanId!)!;
    const moduleOverrides: Record<string, boolean | null> = {};
    const moduleExpirations: Record<string, string | null> = {};
    (body.moduleOverrides ?? []).forEach((m) => {
      moduleOverrides[m.code] = m.value;
      // Срок действия — только у модулей, включённых сверх тарифа
      moduleExpirations[m.code] = m.value === true && !tariff.modules[m.code] ? (m.expiresAt ?? null) : null;
    });
    const discount: Discount = body.discount ?? NO_DISCOUNT;

    const next: OrgRecord = {
      ...current,
      tariffPlanId: tariff.id,
      subscriptionEnabled: Boolean(body.subscriptionEnabled),
      subscriptionStartDate: body.subscriptionStartDate!,
      subscriptionEndDate: body.subscriptionEndDate!,
      moduleOverrides,
      moduleExpirations,
      discount: { type: discount.type, value: discount.value },
      updatedAt: new Date().toISOString(),
      updatedBy: 'SUPERADMIN',
      version: current.version + 1,
    };
    recordSubscriptionChange(current, next, 'SUPERADMIN');
    db.organizations[idx] = next;
    save(db);
    publishChanges(current, next);
    return HttpResponse.json(toDetail(next));
  }),

  // Мониторинг локальных ролей компаний: у суперадминистратора только чтение
  http.get('/api/superadmin/local-roles', async ({ request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const url = new URL(request.url);
    const search = (url.searchParams.get('search') ?? '').trim().toLowerCase();
    const { page, pageSize } = pageOf(url);
    const orgs = load().organizations;
    orgs.forEach((o) => syncMembers(o));
    const store = loadStructure();
    const rows: LocalRoleRow[] = store.roles.flatMap((r) => {
      const org = orgs.find((o) => o.tenantId === r.tenantId);
      if (!org) return [];
      return [
        {
          id: r.id,
          tenantId: r.tenantId,
          organizationName: org.name,
          roleName: r.name,
          departmentName: store.departments.find((d) => d.id === r.departmentId)?.name ?? null,
          employeesCount: roleHolders(store, r).length,
          createdAt: r.createdAt,
        },
      ];
    });
    const filtered = rows
      .filter(
        (r) =>
          !search ||
          [r.organizationName, r.roleName, r.departmentName ?? ''].some((v) => v.toLowerCase().includes(search)),
      )
      .sort((a, b) => a.organizationName.localeCompare(b.organizationName, 'ru') || a.createdAt.localeCompare(b.createdAt));
    return HttpResponse.json({ items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize });
  }),

  http.get('/api/superadmin/local-roles/audit', async ({ request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const { page, pageSize } = pageOf(new URL(request.url));
    const { audit } = loadStructure();
    return HttpResponse.json({ items: audit.slice((page - 1) * pageSize, page * pageSize), total: audit.length, page, pageSize });
  }),

  http.get('/api/superadmin/organizations/:tenantId/structure', async ({ params }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const org = load().organizations.find((o) => o.tenantId === params.tenantId);
    if (!org) return err(404, 'NOT_FOUND');
    const store = syncMembers(org);
    const allowed = delegableOptions(org);
    const roleName = (id: string) => store.roles.find((r) => r.id === id)?.name ?? '';
    const result: OrganizationStructure = {
      tenantId: org.tenantId,
      organizationName: org.name,
      departments: store.departments
        .filter((d) => d.tenantId === org.tenantId)
        .map((d) => ({ id: d.id, parentId: d.parentId, name: d.name })),
      members: store.members
        .filter((m) => m.tenantId === org.tenantId)
        .map((m) => ({
          id: m.id,
          fullName: m.fullName,
          email: m.email,
          departmentId: m.departmentId,
          active: m.active,
          roles: m.localRoleIds.map(roleName),
        })),
      roles: store.roles
        .filter((r) => r.tenantId === org.tenantId)
        .map((r) => ({
          id: r.id,
          name: r.name,
          optionsTotal: r.matrix.length,
          optionsEffective: r.matrix.filter((k) => allowed.includes(k)).length,
        })),
    };
    return HttpResponse.json(result);
  }),

  // Глобальные роли и матрица доступов
  http.get('/api/superadmin/roles', async () => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const users = loadUsers();
    return HttpResponse.json(loadRoles().map((r) => toGlobalRole(r, users)));
  }),

  http.post('/api/superadmin/roles', async ({ request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const body = (await request.json()) as Partial<GlobalRolePayload>;
    const roles = loadRoles();
    const fe = validateRole(body, roles);
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);
    // Новая роль — с пустой матрицей прав (все опции OFF)
    const role: GlobalRoleRecord = {
      id: crypto.randomUUID(),
      code: body.code!.trim(),
      name: body.name!.trim(),
      description: (body.description ?? '').trim(),
      isSystem: false,
      matrix: [],
      updatedAt: new Date().toISOString(),
    };
    saveRoles([...roles, role]);
    return HttpResponse.json(toGlobalRole(role), { status: 201 });
  }),

  http.patch('/api/superadmin/roles/:id', async ({ params, request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const roles = loadRoles();
    const role = roles.find((r) => r.id === params.id);
    if (!role) return err(404, 'NOT_FOUND', 'Роль не найдена.');
    const body = (await request.json()) as Partial<GlobalRolePayload>;
    const fe = validateRole(body, roles, role.id);
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);
    role.name = body.name!.trim();
    role.description = (body.description ?? '').trim();
    role.updatedAt = new Date().toISOString();
    saveRoles(roles);
    return HttpResponse.json(toGlobalRole(role));
  }),

  // «Сохранить матрицу роли»: изменения вступают в силу сразу, кэш прав пользователей роли сбрасывается
  http.put('/api/superadmin/roles/:id/matrix', async ({ params, request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const roles = loadRoles();
    const role = roles.find((r) => r.id === params.id);
    if (!role) return err(404, 'NOT_FOUND', 'Роль не найдена.');
    const body = (await request.json()) as { matrix?: unknown };
    if (!Array.isArray(body.matrix) || body.matrix.some((k) => typeof k !== 'string'))
      return err(400, 'VALIDATION_ERROR', 'Некорректная матрица доступов.');
    const known = new Set(allLeafKeys(loadRegistry()));
    const unknown = (body.matrix as string[]).filter((k) => !known.has(k));
    if (unknown.length) return err(400, 'VALIDATION_ERROR', `Опции нет в Реестре модулей: ${unknown.slice(0, 3).join(', ')}`);
    role.matrix = [...new Set(body.matrix as string[])];
    role.updatedAt = new Date().toISOString();
    saveRoles(roles);
    publishPermissionsChanged(role);
    return HttpResponse.json(toGlobalRole(role));
  }),

  http.delete('/api/superadmin/roles/:id', async ({ params }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const roles = loadRoles();
    const role = roles.find((r) => r.id === params.id);
    if (!role) return err(404, 'NOT_FOUND', 'Роль не найдена.');
    // Базовые системные роли защищены на уровне ядра (is_system = true)
    if (role.isSystem) return err(403, 'SYSTEM_ROLE', 'Системную роль нельзя удалить.');
    const bound = new Set(assignmentsOf(role).map((a) => a.user.id)).size;
    if (bound)
      return err(
        409,
        'ROLE_IN_USE',
        `К роли привязано пользователей: ${bound}. Переназначьте их на другую роль, затем повторите удаление.`,
      );
    saveRoles(roles.filter((r) => r.id !== role.id));
    return new HttpResponse(null, { status: 204 });
  }),

  // Итоговый доступ ролей в организации: Матрица глобальной роли ∩ Состав модулей тарифа
  http.get('/api/superadmin/organizations/:tenantId/role-access', async ({ params }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const org = load().organizations.find((o) => o.tenantId === params.tenantId);
    if (!org) return err(404, 'NOT_FOUND');
    const tariffModules = effectiveModules(org);
    const result: RoleEffectiveAccess[] = loadRoles()
      .filter((r) => r.systemRole !== 'SUPERADMIN')
      .map((r) => {
        const matrixModules = modulesOf(r.matrix);
        const available = modulesOf(effectiveAccess(r.matrix, tariffModules));
        return {
          roleId: r.id,
          roleName: r.name,
          matrixModules,
          availableModules: available,
          blockedModules: matrixModules.filter((m) => !inTariff(m, tariffModules)),
        };
      });
    return HttpResponse.json(result);
  }),

  // Реестр модулей: только просмотр и переименование отображаемых названий
  http.get('/api/superadmin/module-registry', async () => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    return HttpResponse.json(loadRegistry());
  }),

  http.patch('/api/superadmin/module-registry/display-name', async ({ request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const body = (await request.json()) as Partial<RegistryRenamePayload>;
    if (typeof body.key !== 'string') return err(400, 'VALIDATION_ERROR', 'Не указан ключ элемента реестра.');
    let displayName: string | null = null;
    if (body.displayName !== null && body.displayName !== undefined) {
      if (typeof body.displayName !== 'string') return err(400, 'VALIDATION_ERROR', 'Некорректное название.');
      const trimmed = body.displayName.trim().replace(/\s+/g, ' ');
      if (trimmed.length > 120)
        return err(400, 'VALIDATION_ERROR', 'Проверьте название.', { displayName: 'Не более 120 символов' });
      displayName = trimmed || null;
    }
    const module = renameNode(body.key, displayName);
    if (!module) return err(404, 'NOT_FOUND', 'Элемент реестра не найден.');
    return HttpResponse.json(module);
  }),

  // Системный API разработки (CI/CD): публикация или обновление модуля с версией и перечнем опций
  http.post('/api/system/module-registry', async ({ request }) => {
    await latency();
    const body = (await request.json()) as Partial<RegistryPublishPayload>;
    const fe = validatePublish(body);
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Некорректное описание модуля.', fe);
    const source = request.headers.get('X-Publish-Source') === 'CI_CD' ? 'CI_CD' : 'SYSTEM_API';
    const result = publishModule(body as RegistryPublishPayload, source);
    if ('conflict' in result) return err(409, 'VERSION_CONFLICT', result.conflict);
    return HttpResponse.json(result.module, { status: result.created ? 201 : 200 });
  }),

  http.get('/api/superadmin/tariff-plans', async () => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    return HttpResponse.json(load().tariffs.map(toTariffSummary));
  }),

  http.post('/api/superadmin/tariff-plans', async ({ request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const body = (await request.json()) as Partial<TariffPlanPayload>;
    const fe = validateTariff(body);
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);
    const db = load();
    const tariff = toTariffRecord(body as TariffPlanPayload, crypto.randomUUID(), ['KEEP_COMPATIBLE', 'RESET']);
    db.tariffs.push(tariff);
    save(db);
    return HttpResponse.json(toTariffDetail(tariff), { status: 201 });
  }),

  // Изменение шаблона влияет только на новые назначения/продления: условия оформленных периодов хранятся в организации
  http.put('/api/superadmin/tariff-plans/:id', async ({ params, request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const db = load();
    const idx = db.tariffs.findIndex((t) => t.id === params.id);
    if (idx < 0) return err(404, 'NOT_FOUND');
    const body = (await request.json()) as Partial<TariffPlanPayload>;
    const fe = validateTariff(body, String(params.id));
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);
    const tariff = toTariffRecord(body as TariffPlanPayload, db.tariffs[idx]!.id, db.tariffs[idx]!.overridePolicies);
    const affected = db.organizations.filter((o) => o.tariffPlanId === tariff.id);
    const modulesBefore = new Map(affected.map((o) => [o.tenantId, effectiveModules(o)]));
    db.tariffs[idx] = tariff;
    save(db);
    // Набор модулей тарифа применяется к организациям сразу — уведомляем активные сессии
    affected.forEach((o) => {
      const was = modulesBefore.get(o.tenantId)!;
      const now = effectiveModules(o);
      if (was.join() === now.join()) return;
      const base = { tenantId: o.tenantId, version: o.version, changed: ['modules'] as ChangedArea[], occurredAt: new Date().toISOString() };
      publish({ ...base, type: 'tenant-config.updated' });
      const disabled = was.filter((m) => !now.includes(m));
      if (disabled.length) publish({ ...base, type: 'module.disabled', modules: disabled });
    });
    return HttpResponse.json(toTariffDetail(tariff));
  }),

  http.get('/api/superadmin/tariff-plans/:id', async ({ params }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const t = findTariff(String(params.id));
    return t ? HttpResponse.json(toTariffDetail(t)) : err(404, 'NOT_FOUND');
  }),

  // ---------- Tenant ----------
  http.get('/api/tenant/access', async ({ request }) => {
    await latency();
    const ctx = tenantContext(request);
    if (ctx instanceof Response) return ctx;
    return HttpResponse.json(toAccess(ctx.org));
  }),

  http.get('/api/tenant/subscription-summary', async ({ request }) => {
    await latency();
    const ctx = tenantContext(request);
    if (ctx instanceof Response) return ctx;
    if (!canManageOrganization(ctx.user)) return err(403, 'FORBIDDEN');
    return HttpResponse.json(toSummary(ctx.org));
  }),

  http.get('/api/tenant/modules', async ({ request }) => {
    await latency();
    const ctx = tenantContext(request);
    if (ctx instanceof Response) return ctx;
    return subscriptionGuard(ctx.org) ?? HttpResponse.json(toTenantModules(ctx.org));
  }),

  http.get('/api/tenant/usage', async ({ request }) => {
    await latency();
    const ctx = tenantContext(request);
    if (ctx instanceof Response) return ctx;
    if (!canManageOrganization(ctx.user)) return err(403, 'FORBIDDEN');
    return subscriptionGuard(ctx.org) ?? HttpResponse.json(toUsage(ctx.org));
  }),

  // Конструктор курса: модули → дни → элементы контента
  http.get('/api/tenant/courses/:courseId/content', async ({ params, request }) => {
    await latency();
    const ctx = courseContext(request, String(params.courseId));
    if (ctx instanceof Response) return ctx;
    return HttpResponse.json(courseContent(ctx));
  }),

  http.post('/api/tenant/courses/:courseId/modules', async ({ params, request }) => {
    await latency();
    const ctx = courseContext(request, String(params.courseId), true);
    if (ctx instanceof Response) return ctx;
    const body = (await request.json().catch(() => ({}))) as { title?: unknown };
    mutate(ctx.course.id, (modules) => {
      modules.push({
        id: crypto.randomUUID(),
        title: titleOf(body.title, `Модуль ${modules.length + 1}`),
        days: [{ id: crypto.randomUUID(), title: 'День 1', elements: [] }],
      });
    });
    return afterStructureChange(ctx);
  }),

  http.patch('/api/tenant/courses/:courseId/modules/:id', async ({ params, request }) => {
    await latency();
    const ctx = courseContext(request, String(params.courseId), true);
    if (ctx instanceof Response) return ctx;
    const body = (await request.json().catch(() => ({}))) as { title?: unknown };
    const ok = mutate(ctx.course.id, (modules) => {
      const m = modules.find((x) => x.id === params.id);
      if (m) m.title = titleOf(body.title, m.title);
      return Boolean(m);
    });
    return ok ? afterStructureChange(ctx) : err(404, 'NOT_FOUND');
  }),

  http.delete('/api/tenant/courses/:courseId/modules/:id', async ({ params, request }) => {
    await latency();
    const ctx = courseContext(request, String(params.courseId), true);
    if (ctx instanceof Response) return ctx;
    const ok = mutate(ctx.course.id, (modules) => {
      const i = modules.findIndex((x) => x.id === params.id);
      if (i >= 0) modules.splice(i, 1);
      return i >= 0;
    });
    return ok ? afterStructureChange(ctx) : err(404, 'NOT_FOUND');
  }),

  http.post('/api/tenant/courses/:courseId/modules/:id/move', async ({ params, request }) => {
    await latency();
    const ctx = courseContext(request, String(params.courseId), true);
    if (ctx instanceof Response) return ctx;
    const body = (await request.json().catch(() => ({}))) as { direction?: StructureMove };
    mutate(ctx.course.id, (modules) => move(modules, String(params.id), body.direction === 'up' ? 'up' : 'down'));
    return afterStructureChange(ctx);
  }),

  http.post('/api/tenant/courses/:courseId/modules/:id/days', async ({ params, request }) => {
    await latency();
    const ctx = courseContext(request, String(params.courseId), true);
    if (ctx instanceof Response) return ctx;
    const body = (await request.json().catch(() => ({}))) as { title?: unknown };
    const ok = mutate(ctx.course.id, (modules) => {
      const m = modules.find((x) => x.id === params.id);
      m?.days.push({ id: crypto.randomUUID(), title: titleOf(body.title, `День ${m.days.length + 1}`), elements: [] });
      return Boolean(m);
    });
    return ok ? afterStructureChange(ctx) : err(404, 'NOT_FOUND');
  }),

  http.patch('/api/tenant/courses/:courseId/days/:id', async ({ params, request }) => {
    await latency();
    const ctx = courseContext(request, String(params.courseId), true);
    if (ctx instanceof Response) return ctx;
    const body = (await request.json().catch(() => ({}))) as { title?: unknown };
    const ok = mutate(ctx.course.id, (modules) => {
      const d = findDay(modules, String(params.id));
      if (d) d.title = titleOf(body.title, d.title);
      return Boolean(d);
    });
    return ok ? afterStructureChange(ctx) : err(404, 'NOT_FOUND');
  }),

  http.delete('/api/tenant/courses/:courseId/days/:id', async ({ params, request }) => {
    await latency();
    const ctx = courseContext(request, String(params.courseId), true);
    if (ctx instanceof Response) return ctx;
    const ok = mutate(ctx.course.id, (modules) => {
      for (const m of modules) {
        const i = m.days.findIndex((d) => d.id === params.id);
        if (i >= 0) {
          m.days.splice(i, 1);
          return true;
        }
      }
      return false;
    });
    return ok ? afterStructureChange(ctx) : err(404, 'NOT_FOUND');
  }),

  http.post('/api/tenant/courses/:courseId/days/:id/elements', async ({ params, request }) => {
    await latency();
    const ctx = courseContext(request, String(params.courseId), true);
    if (ctx instanceof Response) return ctx;
    const body = (await request.json().catch(() => ({}))) as { type?: ElementType; titleRu?: unknown; titleKz?: unknown };
    const titleRu = typeof body.titleRu === 'string' ? body.titleRu.trim() : '';
    const titleKz = typeof body.titleKz === 'string' ? body.titleKz.trim() : '';
    if (!titleRu && !titleKz)
      return err(400, 'VALIDATION_ERROR', 'Укажите название элемента.', { titleRu: 'Укажите название хотя бы на одном языке' });
    if (titleRu.length > 255 || titleKz.length > 255)
      return err(400, 'VALIDATION_ERROR', 'Название — не более 255 символов.', { titleRu: 'Не более 255 символов' });
    const el = newElement(body.type as ElementType, titleRu, titleKz);
    if (!el) return err(400, 'VALIDATION_ERROR', 'Неизвестный тип элемента.');
    if (!canElement(ctx.user.access, el.type, 'create')) return err(403, 'FORBIDDEN', 'Нет права на создание элемента этого типа.');
    const ok = mutate(ctx.course.id, (modules) => {
      const d = findDay(modules, String(params.id));
      d?.elements.push(el);
      return Boolean(d);
    });
    if (!ok) return err(404, 'NOT_FOUND');
    touchCourse(ctx.org, ctx.course.id, {});
    return HttpResponse.json(el, { status: 201 });
  }),

  http.put('/api/tenant/courses/:courseId/elements/:id', async ({ params, request }) => {
    await latency();
    const ctx = courseContext(request, String(params.courseId), true);
    if (ctx instanceof Response) return ctx;
    const body = (await request.json().catch(() => ({}))) as Partial<ElementPayload>;
    const result = mutate(ctx.course.id, (modules) => {
      const found = findElement(modules, String(params.id));
      if (!found) return null;
      if (!canElement(ctx.user.access, found.element.type, 'edit')) return { forbidden: true as const };
      const errors = applyElement(found.element, body);
      return errors ? { errors } : { element: structuredClone(found.element) };
    });
    if (!result) return err(404, 'NOT_FOUND', 'Элемент не найден.');
    if ('forbidden' in result) return err(403, 'FORBIDDEN', 'Нет права на редактирование элемента этого типа.');
    if ('errors' in result) return err(400, 'VALIDATION_ERROR', 'Проверьте настройки элемента.', result.errors);
    touchCourse(ctx.org, ctx.course.id, {});
    return HttpResponse.json(result.element);
  }),

  http.delete('/api/tenant/courses/:courseId/elements/:id', async ({ params, request }) => {
    await latency();
    const ctx = courseContext(request, String(params.courseId), true);
    if (ctx instanceof Response) return ctx;
    const found = findElement(getStructure(ctx.course.id), String(params.id));
    if (!found) return err(404, 'NOT_FOUND');
    if (!canElement(ctx.user.access, found.element.type, 'delete'))
      return err(403, 'FORBIDDEN', 'Нет права на удаление элемента этого типа.');
    mutate(ctx.course.id, (modules) => {
      const f = findElement(modules, String(params.id));
      if (f) f.day.elements = f.day.elements.filter((e) => e.id !== params.id);
    });
    return afterStructureChange(ctx);
  }),

  http.post('/api/tenant/courses/:courseId/elements/:id/move', async ({ params, request }) => {
    await latency();
    const ctx = courseContext(request, String(params.courseId), true);
    if (ctx instanceof Response) return ctx;
    const body = (await request.json().catch(() => ({}))) as { direction?: StructureMove };
    mutate(ctx.course.id, (modules) => {
      const found = findElement(modules, String(params.id));
      if (found) move(found.day.elements, String(params.id), body.direction === 'up' ? 'up' : 'down');
    });
    return afterStructureChange(ctx);
  }),

  http.get('/api/tenant/modules/:code/data', async ({ params, request }) => {
    await latency();
    const ctx = tenantContext(request);
    if (ctx instanceof Response) return ctx;
    const blocked = subscriptionGuard(ctx.org);
    if (blocked) return blocked;
    const code = String(params.code);
    const def = MODULES.find((m) => m.code === code);
    if (!def || !effectiveModules(ctx.org).includes(code)) return err(403, 'MODULE_DISABLED');
    if (!ctx.user.permissions.includes(def.permission)) return err(403, 'FORBIDDEN');
    const action = CREATE_ACTIONS[code];
    const limits = effectiveLimitValues(ctx.org);
    // Действие создания показывается только при наличии права на управление
    const create =
      action && ctx.user.permissions.includes(action.permission)
        ? {
            label: action.label,
            limitCode: action.limitCode,
            available: (ctx.org.usage[action.limitCode] ?? 0) < limits[action.limitCode]!,
          }
        : undefined;
    if (code === 'COURSES') {
      return HttpResponse.json({
        title: def.name,
        kind: 'courses',
        items: [],
        courses: listCourses(ctx.org),
        categories: COURSE_CATEGORIES,
        create,
      });
    }
    if (code === 'WEBINARS') {
      return HttpResponse.json({ title: def.name, kind: 'webinars', items: [], webinars: listWebinars(ctx.org, ctx.user.id) });
    }
    return HttpResponse.json({
      title: def.name,
      kind: 'generic',
      items: [def.description, 'Данные модуля загружены с сервера'],
      create,
    });
  }),

  http.post('/api/tenant/modules/:code/items', async ({ params, request }) => {
    await latency();
    const ctx = tenantContext(request);
    if (ctx instanceof Response) return ctx;
    const blocked = subscriptionGuard(ctx.org);
    if (blocked) return blocked;
    const code = String(params.code);
    const def = MODULES.find((m) => m.code === code);
    const action = CREATE_ACTIONS[code];
    if (!def || !effectiveModules(ctx.org).includes(code)) return err(403, 'MODULE_DISABLED');
    if (!action || !ctx.user.permissions.includes(def.permission) || !ctx.user.permissions.includes(action.permission))
      return err(403, 'FORBIDDEN');
    const limit = effectiveLimitValues(ctx.org)[action.limitCode]!;
    const used = ctx.org.usage[action.limitCode] ?? 0;
    if (used >= limit) return err(403, 'LIMIT_REACHED');

    const body = (await request.json().catch(() => ({}))) as { title?: string; category?: string };
    if (code === 'COURSES') {
      const title = (body.title ?? '').trim();
      if (title.length < 3 || title.length > 120)
        return err(400, 'VALIDATION_ERROR', 'Название курса — от 3 до 120 символов', { title: 'Название курса — от 3 до 120 символов' });
      addCourse(ctx.org, { title, category: body.category || 'Без категории', teacher: ctx.user.fullName });
    }

    const db = load();
    const org = db.organizations.find((o) => o.tenantId === ctx.org.tenantId)!;
    // Использование считает сервер: для курсов — по фактическому числу курсов
    org.usage[action.limitCode] = code === 'COURSES' ? courseCount(ctx.org) : used + 1;
    save(db);
    publish({
      type: 'limits.updated',
      tenantId: org.tenantId,
      version: org.version,
      changed: ['limits'],
      occurredAt: new Date().toISOString(),
    });
    return HttpResponse.json({ ok: true });
  }),

  http.post('/api/tenant/webinars/:id/registration', async ({ params, request }) => {
    await latency();
    const ctx = tenantContext(request);
    if (ctx instanceof Response) return ctx;
    const blocked = subscriptionGuard(ctx.org);
    if (blocked) return blocked;
    if (!effectiveModules(ctx.org).includes('WEBINARS')) return err(403, 'MODULE_DISABLED');
    if (!ctx.user.permissions.includes('webinars.view')) return err(403, 'FORBIDDEN');
    const registered = toggleWebinarRegistration(ctx.org, String(params.id), ctx.user.id);
    if (registered === null) return err(400, 'VALIDATION_ERROR', 'Запись на этот вебинар недоступна');
    return HttpResponse.json({ registered });
  }),

  // ---------- Dev: имитация онлайн-оплаты (SYSTEM_PAYMENT) ----------
  http.post('/api/__dev/simulate-payment/:tenantId', async ({ params }) => {
    const db = load();
    const org = db.organizations.find((o) => o.tenantId === params.tenantId || o.clientSlug === params.tenantId);
    if (!org) return err(404, 'NOT_FOUND');
    const before = structuredClone(org);
    const base = dayjs(org.subscriptionEndDate).isAfter(dayjs()) ? dayjs(org.subscriptionEndDate) : dayjs();
    org.subscriptionEnabled = true;
    org.subscriptionEndDate = base.add(1, 'year').format('YYYY-MM-DD');
    // Подписка истекла — новый период начинается с даты оплаты
    if (before.subscriptionEndDate < dayjs().format('YYYY-MM-DD')) org.subscriptionStartDate = dayjs().format('YYYY-MM-DD');
    org.updatedAt = new Date().toISOString();
    org.updatedBy = 'SYSTEM_PAYMENT';
    org.version += 1;
    // Вебхук онлайн-оплаты тоже создаёт запись в истории
    recordSubscriptionChange(before, org, 'SYSTEM_PAYMENT');
    save(db);
    publishChanges(before, org);
    return HttpResponse.json(toDetail(org));
  }),
];

handlers.push(...tenantAdminHandlers());

/**
 * SSE: только события своей организации, только авторизованным участникам.
 * Фабрика, т.к. MSW требует EventSource при создании обработчика (в jsdom его нет).
 */
export function createSseHandler() {
  return sse<{ [K in TenantEvent['type']]: string }>('/api/tenant/events', ({ request, client }) => {
    if (sseDisabled()) {
      client.error();
      return;
    }
    const ctx = tenantContext(request);
    if (ctx instanceof Response) {
      client.error();
      return;
    }
    const unsubscribe = subscribe((event) => {
      if (event.tenantId !== ctx.org.tenantId) return;
      try {
        client.send({ event: event.type, data: JSON.stringify(event) });
      } catch {
        unsubscribe();
      }
    });
    request.signal.addEventListener('abort', unsubscribe);
  });
}
