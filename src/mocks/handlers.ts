import { delay, http, HttpResponse, sse } from 'msw';
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
  Discount,
  SubscriptionHistoryEntry,
  SubscriptionOperation,
  SubscriptionSettingsPayload,
  TariffPlanPayload,
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
  sameAssignment,
  saveUsers,
  toCurrentUser,
  type UserRecord,
} from './users';
import { EMAIL_PATTERN, isValidIin, isValidKzPhone, isValidPassword, MESSAGES, phoneDigits } from '@/features/auth/validation';
import { addCourse, COURSE_CATEGORIES, courseCount, listCourses, listWebinars, removeContent, toggleWebinarRegistration } from './content';

const latency = () => {
  // Отложенные задачи планировщика выполняются до обработки запроса (плюс интервал в browser.ts)
  runModuleExpirations();
  return delay(import.meta.env.MODE === 'test' ? 0 : 250);
};

const err = (status: number, code: string, message?: string, fieldErrors?: Record<string, string>) =>
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
function tenantContext(request: Request): { org: OrgRecord; user: CurrentUser } | Response {
  const user = getSession();
  if (!user) return err(401, 'UNAUTHORIZED');
  const slug = new URL(request.url).searchParams.get('clientSlug');
  if (user.role !== 'SUPERADMIN' && user.clientSlug !== slug) return err(403, 'FORBIDDEN');
  const org = load().organizations.find((o) => o.clientSlug === slug);
  if (!org) return err(404, 'NOT_FOUND');
  return { org, user };
}

function subscriptionGuard(org: OrgRecord): Response | null {
  const status = computeStatus(org);
  if (status === 'BLOCKED') return err(403, 'TENANT_BLOCKED');
  if (status === 'EXPIRED') return err(403, 'SUBSCRIPTION_EXPIRED');
  return null;
}

const canManageOrganization = (u: CurrentUser) =>
  u.role === 'SUPERADMIN' || u.permissions.includes('organization.manage');

/** Действия создания, ограниченные лимитом. */
const CREATE_ACTIONS: Record<string, { label: string; limitCode: string; permission: string }> = {
  COURSES: { label: 'Создать курс', limitCode: 'COURSES_COUNT', permission: 'courses.manage' },
};

/** Роли, доступные для входа: роли заблокированных организаций и организаций с истёкшей подпиской исключаются. */
function activeRoles(user: UserRecord): RoleAssignment[] {
  const orgs = load().organizations;
  return user.roles.flatMap((r) => {
    if (!r.clientSlug) return [r];
    const org = orgs.find((o) => o.clientSlug === r.clientSlug);
    return org && computeStatus(org) === 'ACTIVE' ? [{ ...r, organizationName: org.name }] : [];
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

/** Раздел «Пользователи»: Суперадминистратор или Администратор клиента этой организации. */
function requireUsersManager(slug: string): Response | null {
  const session = getSession();
  if (!session) return err(401, 'UNAUTHORIZED');
  if (!load().organizations.some((o) => o.clientSlug === slug)) return err(404, 'NOT_FOUND');
  if (session.role === 'SUPERADMIN') return null;
  if (session.role === 'ORGANIZATION_ADMIN' && session.clientSlug === slug) return null;
  return err(403, 'FORBIDDEN');
}

const toOrganizationUser = (u: UserRecord, slug: string): OrganizationUser => ({
  id: u.id,
  fullName: fullNameOf(u),
  iin: u.iin,
  email: u.email,
  roles: u.roles.filter((r) => r.clientSlug === slug).map((r): Role => r.role),
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
    roles: u.roles.map((r) => ({ ...r, organizationName: orgs.find((o) => o.clientSlug === r.clientSlug)?.name })),
  };
}

/** Те же правила, что и при регистрации; уникальность ИИН и email — без учёта редактируемого пользователя. */
function validateUserProfile(
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

const profileFields = (body: Partial<PlatformUserPayload>) => ({
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

export const handlers = [
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
  http.post('/api/organizations/:slug/users/roles', async ({ params, request }) => {
    await latency();
    const slug = String(params.slug);
    const denied = requireUsersManager(slug);
    if (denied) return denied;
    const { iin = '', role } = (await request.json()) as { iin?: string; role?: AssignableRole };
    if (role !== 'ORGANIZATION_ADMIN' && role !== 'TRAINER')
      return err(400, 'VALIDATION_ERROR', undefined, { role: 'Выберите роль' });
    const users = loadUsers();
    const user = users.find((u) => u.iin === iin.trim());
    if (!user) return err(400, 'VALIDATION_ERROR', undefined, { iin: 'Пользователь с таким ИИН не найден' });
    if (user.roles.some((r) => sameAssignment(r, { role, clientSlug: slug })))
      return err(400, 'VALIDATION_ERROR', undefined, { role: 'У пользователя уже есть эта роль в организации' });
    user.roles.push({ role, clientSlug: slug });
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
