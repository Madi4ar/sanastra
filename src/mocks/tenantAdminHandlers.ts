/**
 * API кабинета администратора организации: оплата, сотрудники, отделы, локальные роли,
 * группы, отчёты, каталог модулей. Доступ к разделам — по итоговому доступу (матрица ∩ тариф).
 */
import dayjs from 'dayjs';
import { http, HttpResponse } from 'msw';
import type {
  BillingInfo,
  CatalogModule,
  CurrentUser,
  DepartmentKind,
  OrgDepartmentPayload,
  OrgGroup,
  OrgGroupPayload,
  OrgMember,
  OrgMemberPayload,
  PaymentPeriod,
  RegistryModule,
  RegistryOption,
  ReportResult,
  ReportType,
  SystemOrgRole,
  TenantRole,
  TenantRolePayload,
} from '@/api/types';
import { finalPrice, planAmount } from '@/shared/pricing';
import { computeStatus, effectiveLimitValues, effectiveModules, load, MODULES, save, type OrgRecord } from './db';
import { courseCount, findCourse, listCourses, removeCourse, updateCourse } from './content';
import { removeCourseContent } from './courseBuilder';
import { err, latency, profileFields, publishChanges, recordSubscriptionChange, subscriptionGuard, tenantContext, validateUserProfile } from './handlers';
import { addAudit, loadStructure, roleHolders, saveStructure, syncMembers, type LocalRole, type Member } from './orgStructure';
import { canContinue, currentMonths, markPaid, newSchedule, planFor, scheduleEndDate } from './paymentSchedule';
import { loadRegistry } from './registry';
import { loadRoles, SYSTEM_ROLE_CODE } from './roles';
import { accessFor, fullNameOf, hashPassword, loadUsers, saveUsers, type UserRecord } from './users';

const SYSTEM_ORG_ROLES: SystemOrgRole[] = ['ORGANIZATION_ADMIN', 'TRAINER', 'LEARNER'];
const KINDS: DepartmentKind[] = ['DEPARTMENT', 'MANAGEMENT', 'BRANCH', 'UNIT'];
const USERS_LIMIT = 'USERS_COUNT';

type Ctx = { org: OrgRecord; user: CurrentUser };

/** Раздел доступен при наличии опции в итоговом доступе. Суперадминистратор не управляет структурой компании. */
function sectionContext(request: Request, option: string): Ctx | Response {
  const ctx = tenantContext(request);
  if (ctx instanceof Response) return ctx;
  const blocked = subscriptionGuard(ctx.org);
  if (blocked) return blocked;
  if (ctx.user.role === 'SUPERADMIN' || !ctx.user.access.includes(option)) return err(403, 'FORBIDDEN');
  return ctx;
}

/** Оплата и каталог — только для администратора; истёкшая подписка оплате не мешает */
function adminContext(request: Request): Ctx | Response {
  const ctx = tenantContext(request);
  if (ctx instanceof Response) return ctx;
  if (ctx.user.role !== 'ORGANIZATION_ADMIN') return err(403, 'FORBIDDEN');
  return ctx;
}

const orgRoleOf = (u: UserRecord | undefined, slug: string): SystemOrgRole | null => {
  const roles = u?.roles.filter((r) => r.clientSlug === slug).map((r) => r.role) ?? [];
  return SYSTEM_ORG_ROLES.find((r) => roles.includes(r)) ?? null;
};

function toMember(m: Member, org: OrgRecord, users: UserRecord[], selfId: string): OrgMember {
  const store = loadStructure();
  const u = users.find((x) => x.id === m.userId);
  const localRoles = store.roles.filter((r) => m.localRoleIds.includes(r.id));
  return {
    id: m.id,
    fullName: u ? fullNameOf(u) : m.fullName,
    lastName: u?.lastName ?? '',
    firstName: u?.firstName ?? '',
    middleName: u?.middleName,
    iin: u?.iin ?? '',
    email: u?.email ?? m.email,
    phone: u?.phone ?? '',
    region: u?.region ?? '',
    active: m.active,
    role: orgRoleOf(u, org.clientSlug),
    departmentId: m.departmentId,
    departmentName: store.departments.find((d) => d.id === m.departmentId)?.name ?? null,
    localRoleIds: m.localRoleIds,
    localRoleNames: localRoles.map((r) => r.name),
    isSelf: m.userId === selfId,
  };
}

/** Изменение использования USERS_COUNT считает сервер */
function changeUsersUsage(tenantId: string, delta: number) {
  const db = load();
  const org = db.organizations.find((o) => o.tenantId === tenantId);
  if (!org) return;
  org.usage[USERS_LIMIT] = Math.max(0, (org.usage[USERS_LIMIT] ?? 0) + delta);
  save(db);
}

const usersLimitReached = (org: OrgRecord) => (org.usage[USERS_LIMIT] ?? 0) >= effectiveLimitValues(org)[USERS_LIMIT]!;

const limitError = () => err(403, 'LIMIT_REACHED', 'Достигнут лимит пользователей текущего тарифа.');

function bindDepartment(store: ReturnType<typeof loadStructure>, ctx: Ctx, m: Member, departmentId: string | null) {
  if (m.departmentId === departmentId) return;
  const previous = store.departments.find((d) => d.id === m.departmentId);
  const next = store.departments.find((d) => d.id === departmentId);
  m.departmentId = departmentId;
  addAudit(store, ctx.org, ctx.user.id, 'USER_BOUND_TO_DEPARTMENT', m.fullName, [
    { field: 'Отдел', oldValue: previous?.name ?? null, newValue: next?.name ?? null },
  ]);
}

// ---------- оплата ----------

function toBilling(org: OrgRecord): BillingInfo {
  const db = load();
  const current = db.tariffs.find((t) => t.id === org.tariffPlanId)!;
  return {
    status: computeStatus(org),
    tariffName: current.name,
    tariffDescription: current.description,
    subscriptionStartDate: org.subscriptionStartDate,
    subscriptionEndDate: org.subscriptionEndDate,
    basePrice: org.annualPrice,
    discount: org.discount,
    finalPrice: finalPrice(org.annualPrice, org.discount),
    history: org.history,
    months: currentMonths(org),
    // Переход возможен на текущий или более дорогой тариф; понижение выполняет суперадминистратор
    tariffs: db.tariffs
      .filter((t) => t.id === current.id || t.annualPrice > current.annualPrice)
      .sort((a, b) => a.annualPrice - b.annualPrice)
      .map((t) => {
        const final = finalPrice(t.annualPrice, org.discount);
        return {
          id: t.id,
          name: t.name,
          description: t.description,
          annualPrice: t.annualPrice,
          finalPrice: final,
          monthlyPrice: Math.round(final / 12),
          modules: MODULES.filter((m) => t.modules[m.code]).map((m) => m.name),
          isCurrent: t.id === current.id,
          plan: planFor(org, t.id, final, Math.round(final / 12)),
        };
      }),
  };
}

// ---------- роли ----------

/** Что компания может делегировать: глобальная роль администратора ∩ тариф */
const delegable = (org: OrgRecord) => accessFor({ role: 'ORGANIZATION_ADMIN', clientSlug: org.clientSlug });

function pruneCatalog(allowed: string[]): RegistryModule[] {
  const prune = (nodes: RegistryOption[]): RegistryOption[] =>
    nodes.flatMap((n) => {
      if (!n.options?.length) return allowed.includes(n.key) ? [n] : [];
      const options = prune(n.options);
      return options.length ? [{ ...n, options }] : [];
    });
  return loadRegistry().flatMap((m) => {
    const options = prune(m.options);
    return options.length ? [{ ...m, options }] : [];
  });
}

function toTenantRole(r: LocalRole, store: ReturnType<typeof loadStructure>, allowed: string[]): TenantRole {
  return {
    id: r.id,
    nameRu: r.name,
    nameKz: r.nameKz,
    description: r.description,
    isSystem: false,
    matrix: r.matrix.filter((k) => allowed.includes(k)),
    scope: r.scope,
    departmentId: r.departmentId,
    memberIds: store.members.filter((m) => m.localRoleIds.includes(r.id)).map((m) => m.id),
    employeesCount: roleHolders(store, r).length,
  };
}

function validateRole(body: Partial<TenantRolePayload>, ctx: Ctx, selfId?: string): { fe: Record<string, string>; matrix: string[] } {
  const store = loadStructure();
  const fe: Record<string, string> = {};
  const nameRu = (body.nameRu ?? '').trim();
  const nameKz = (body.nameKz ?? '').trim();
  if (nameRu.length < 2 || nameRu.length > 60) fe.nameRu = 'Название — от 2 до 60 символов';
  if (nameKz.length < 2 || nameKz.length > 60) fe.nameKz = 'Название — от 2 до 60 символов';
  if (store.roles.some((r) => r.tenantId === ctx.org.tenantId && r.id !== selfId && r.name.toLowerCase() === nameRu.toLowerCase()))
    fe.nameRu = 'Роль с таким названием уже есть';
  if ((body.description ?? '').length > 500) fe.description = 'Не более 500 символов';
  if (body.scope === 'DEPARTMENT') {
    if (!store.departments.some((d) => d.id === body.departmentId && d.tenantId === ctx.org.tenantId)) fe.departmentId = 'Выберите отдел';
  } else if (body.scope !== 'MEMBERS') fe.scope = 'Выберите, к кому привязана роль';
  const matrix = Array.isArray(body.matrix) ? [...new Set(body.matrix.filter((k) => typeof k === 'string'))] : [];
  const allowed = delegable(ctx.org);
  const denied = matrix.filter((k) => !allowed.includes(k));
  if (denied.length) fe.matrix = `Опции не разрешены тарифом или глобальной ролью администратора: ${denied.slice(0, 3).join(', ')}`;
  return { fe, matrix };
}

function applyRoleMembers(store: ReturnType<typeof loadStructure>, role: LocalRole, org: OrgRecord, memberIds: string[]) {
  const ids = role.scope === 'MEMBERS' ? memberIds : [];
  store.members
    .filter((m) => m.tenantId === org.tenantId)
    .forEach((m) => {
      const has = m.localRoleIds.includes(role.id);
      if (ids.includes(m.id) && !has) m.localRoleIds.push(role.id);
      if (!ids.includes(m.id) && has) m.localRoleIds = m.localRoleIds.filter((x) => x !== role.id);
    });
}

// ---------- группы ----------

const toGroup = (g: OrgGroup, org: OrgRecord): OrgGroup => ({
  ...g,
  courseTitle: g.courseId ? (findCourse(org, g.courseId)?.title ?? null) : null,
});

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function validateGroup(body: Partial<OrgGroupPayload>, org: OrgRecord): Record<string, string> {
  const fe: Record<string, string> = {};
  const name = (body.name ?? '').trim();
  if (name.length < 2 || name.length > 120) fe.name = 'Название — от 2 до 120 символов';
  if (body.courseId && !findCourse(org, body.courseId)) fe.courseId = 'Программа не найдена';
  if (body.startDate && body.endDate && body.endDate < body.startDate) fe.endDate = 'Дата окончания раньше даты начала';
  for (const k of ['timeFrom', 'timeTo'] as const) if (body[k] && !TIME.test(body[k]!)) fe[k] = 'Формат ЧЧ:ММ';
  if (body.timeFrom && body.timeTo && !fe.timeFrom && !fe.timeTo && body.timeTo <= body.timeFrom) fe.timeTo = 'Окончание раньше начала';
  return fe;
}

const groupFields = (b: Partial<OrgGroupPayload>) => ({
  name: (b.name ?? '').trim(),
  courseId: b.courseId || null,
  startDate: b.startDate || null,
  endDate: b.endDate || null,
  days: Array.isArray(b.days) ? b.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [],
  timeFrom: b.timeFrom || null,
  timeTo: b.timeTo || null,
});

// ---------- отчёты ----------

/** Детерминированное значение 0..99: мок-бэкенд не хранит фактов обучения */
function metric(...parts: string[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 100;
}

const REPORT_TITLE: Record<ReportType, string> = {
  PERFORMANCE: 'Успеваемость',
  COMPLETION: 'Прохождение курсов',
  ATTENDANCE: 'Посещаемость',
  ACTIVITY: 'Активность пользователей',
};

function buildReport(type: ReportType, org: OrgRecord, f: { groupId: string | null; courseId: string | null }): ReportResult {
  const store = syncMembers(org);
  const group = store.groups.find((g) => g.id === f.groupId && g.tenantId === org.tenantId);
  const members = store.members.filter((m) => m.tenantId === org.tenantId && m.active && (!group || group.listenerIds.includes(m.id)));
  const courses = listCourses(org).filter((c) => !f.courseId || c.id === f.courseId);
  const base = { type, title: REPORT_TITLE[type], generatedAt: new Date().toISOString() };
  const groupOf = (m: Member) => store.groups.filter((g) => g.tenantId === org.tenantId && g.listenerIds.includes(m.id)).map((g) => g.name).join(', ') || '—';

  if (type === 'COMPLETION')
    return {
      ...base,
      columns: [
        { key: 'course', title: 'Программа' },
        { key: 'enrolled', title: 'Записано' },
        { key: 'completed', title: 'Завершили' },
        { key: 'percent', title: 'Завершили, %' },
      ],
      rows: courses.map((c) => {
        const completed = members.filter((m) => metric(m.id, c.id) >= 40).length;
        return {
          course: c.title,
          enrolled: members.length,
          completed,
          percent: members.length ? Math.round((completed / members.length) * 100) : 0,
        };
      }),
    };
  if (type === 'PERFORMANCE')
    return {
      ...base,
      columns: [
        { key: 'name', title: 'Сотрудник' },
        { key: 'group', title: 'Группа' },
        { key: 'score', title: 'Средний балл, %' },
        { key: 'tests', title: 'Сдано тестов' },
      ],
      rows: members.map((m) => ({
        name: m.fullName,
        group: groupOf(m),
        score: 50 + metric(m.id, 'score', f.courseId ?? '') % 51,
        tests: metric(m.id, 'tests', f.courseId ?? '') % 12,
      })),
    };
  if (type === 'ATTENDANCE')
    return {
      ...base,
      columns: [
        { key: 'name', title: 'Сотрудник' },
        { key: 'group', title: 'Группа' },
        { key: 'attended', title: 'Посещено занятий' },
        { key: 'percent', title: 'Посещаемость, %' },
      ],
      rows: members.map((m) => {
        const attended = metric(m.id, 'attendance') % 21;
        return { name: m.fullName, group: groupOf(m), attended, percent: Math.round((attended / 20) * 100) };
      }),
    };
  return {
    ...base,
    columns: [
      { key: 'name', title: 'Сотрудник' },
      { key: 'department', title: 'Отдел' },
      { key: 'visits', title: 'Входов за 30 дней' },
      { key: 'lastVisit', title: 'Последний вход' },
    ],
    rows: members.map((m) => ({
      name: m.fullName,
      department: store.departments.find((d) => d.id === m.departmentId)?.name ?? '—',
      visits: metric(m.id, 'visits') % 31,
      lastVisit: dayjs().subtract(metric(m.id, 'last') % 14, 'day').format('DD.MM.YYYY'),
    })),
  };
}

export const tenantAdminHandlers = () => [
  // ---------- Каталог модулей: рабочие и демо ----------
  http.get('/api/tenant/module-catalog', async ({ request }) => {
    await latency();
    const ctx = adminContext(request);
    if (ctx instanceof Response) return ctx;
    const enabled = effectiveModules(ctx.org);
    const tariffs = [...load().tariffs].sort((a, b) => a.annualPrice - b.annualPrice);
    const current = tariffs.find((t) => t.id === ctx.org.tariffPlanId);
    const result: CatalogModule[] = MODULES.map((m) => {
      const target = tariffs.find((t) => t.modules[m.code] && t.annualPrice > (current?.annualPrice ?? 0));
      return {
        code: m.code,
        name: m.name,
        description: m.description,
        icon: m.icon,
        enabled: enabled.includes(m.code),
        upgradeTariff: target ? { id: target.id, name: target.name } : null,
      };
    });
    return HttpResponse.json(result);
  }),

  // ---------- Тарифные планы и оплата ----------
  http.get('/api/tenant/billing', async ({ request }) => {
    await latency();
    const ctx = adminContext(request);
    if (ctx instanceof Response) return ctx;
    return HttpResponse.json(toBilling(ctx.org));
  }),

  http.post('/api/tenant/payments', async ({ request }) => {
    await latency();
    const ctx = adminContext(request);
    if (ctx instanceof Response) return ctx;
    if (computeStatus(ctx.org) === 'BLOCKED') return err(403, 'TENANT_BLOCKED');
    const body = (await request.json().catch(() => ({}))) as { tariffPlanId?: string; period?: PaymentPeriod; months?: number[] };
    const offer = toBilling(ctx.org).tariffs.find((t) => t.id === body.tariffPlanId);
    if (!offer) return err(400, 'VALIDATION_ERROR', 'Этот тариф недоступен для оплаты.');
    if (body.period !== 'YEAR' && body.period !== 'MONTH') return err(400, 'VALIDATION_ERROR', 'Выберите период оплаты.');
    const unpaid = offer.plan.months.filter((m) => !m.paid).map((m) => m.index);
    // За год — все неоплаченные месяцы; помесячно — выбранные
    const months = body.period === 'YEAR' ? unpaid : [...new Set(body.months ?? [])].sort((a, b) => a - b);
    if (!months.length) return err(400, 'VALIDATION_ERROR', 'Выберите хотя бы один месяц.');
    if (months.some((i) => !unpaid.includes(i))) return err(400, 'VALIDATION_ERROR', 'Выбранный месяц уже оплачен или не входит в период.');
    const store = loadStructure();
    const order = {
      id: crypto.randomUUID(),
      tenantId: ctx.org.tenantId,
      tariffPlanId: offer.id,
      tariffName: offer.name,
      period: body.period,
      months,
      amount: planAmount(offer.plan, months.length),
      annualAmount: offer.plan.annualAmount,
      monthlyAmount: offer.plan.monthlyAmount,
      status: 'PENDING' as const,
    };
    store.payments.push(order);
    saveStructure(store);
    return HttpResponse.json(order, { status: 201 });
  }),

  // Вебхук эквайринга: успешный платёж продлевает подписку на +1 месяц или +1 год и сразу активирует доступ
  http.post('/api/tenant/payments/:id/webhook', async ({ params, request }) => {
    await latency();
    const ctx = adminContext(request);
    if (ctx instanceof Response) return ctx;
    const body = (await request.json().catch(() => ({}))) as { outcome?: string };
    const store = loadStructure();
    const order = store.payments.find((p) => p.id === params.id && p.tenantId === ctx.org.tenantId);
    if (!order) return err(404, 'NOT_FOUND');
    if (order.status === 'PAID') return HttpResponse.json(toBilling(ctx.org));
    if (body.outcome !== 'SUCCESS') {
      order.status = 'DECLINED';
      saveStructure(store);
      return err(400, 'VALIDATION_ERROR', 'Банк отклонил платёж. Деньги не списаны, срок подписки не изменился.');
    }
    const db = load();
    const org = db.organizations.find((o) => o.tenantId === ctx.org.tenantId)!;
    const before = structuredClone(org);
    // Продолжение графика или новый годовой период
    if (!canContinue(org, order.tariffPlanId)) {
      const plan = toBilling(org).tariffs.find((t) => t.id === order.tariffPlanId)!.plan;
      org.paymentSchedule = newSchedule(order.tariffPlanId, plan.startDate, order.annualAmount, order.monthlyAmount);
      if (plan.startDate <= dayjs().format('YYYY-MM-DD')) org.subscriptionStartDate = plan.startDate;
    }
    markPaid(org.paymentSchedule!, order.months, order.amount);
    org.tariffPlanId = order.tariffPlanId;
    org.subscriptionEnabled = true;
    org.subscriptionEndDate = scheduleEndDate(org.paymentSchedule!);
    org.updatedAt = new Date().toISOString();
    org.updatedBy = 'SYSTEM_PAYMENT';
    org.version += 1;
    const lastEntry = org.history[0]?.id;
    recordSubscriptionChange(before, org, 'SYSTEM_PAYMENT');
    const payment = { months: order.months.length, amount: order.amount };
    if (org.history[0]?.id !== lastEntry) org.history[0]!.payment = payment;
    else {
      // Срок не сдвинулся (оплачены более поздние месяцы), но платёж всё равно попадает в историю
      const tariff = db.tariffs.find((t) => t.id === org.tariffPlanId)!;
      org.history = [
        {
          id: crypto.randomUUID(),
          operation: 'PAYMENT',
          operationAt: new Date().toISOString(),
          tariffName: tariff.name,
          periodStart: org.subscriptionStartDate,
          periodEnd: org.subscriptionEndDate,
          basePrice: org.annualPrice,
          discount: org.discount,
          finalPrice: finalPrice(org.annualPrice, org.discount),
          status: 'ACTIVE',
          source: 'SYSTEM_PAYMENT',
          payment,
        },
        ...org.history.map((h) => ({ ...h, status: 'COMPLETED' as const })),
      ];
    }
    save(db);
    order.status = 'PAID';
    saveStructure(store);
    publishChanges(before, org);
    return HttpResponse.json(toBilling(org));
  }),

  // ---------- Пользователи ----------
  http.get('/api/tenant/members', async ({ request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_users.list_view');
    if (ctx instanceof Response) return ctx;
    const store = syncMembers(ctx.org, true);
    const users = loadUsers();
    return HttpResponse.json(
      store.members
        .filter((m) => m.tenantId === ctx.org.tenantId)
        .map((m) => toMember(m, ctx.org, users, ctx.user.id))
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru')),
    );
  }),

  http.post('/api/tenant/members', async ({ request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_users.create');
    if (ctx instanceof Response) return ctx;
    if (usersLimitReached(ctx.org)) return limitError();
    const body = (await request.json().catch(() => ({}))) as Partial<OrgMemberPayload>;
    const users = loadUsers();
    const fe = validateUserProfile(body, users, { passwordRequired: true });
    if (!SYSTEM_ORG_ROLES.includes(body.role as SystemOrgRole)) fe.role = 'Выберите роль';
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);
    const user: UserRecord = {
      id: crypto.randomUUID(),
      ...profileFields(body),
      passwordHash: hashPassword(body.password!),
      roles: [{ role: body.role as SystemOrgRole, clientSlug: ctx.org.clientSlug }],
      failedAttempts: 0,
      profileCompleted: false,
    };
    saveUsers([...users, user]);
    const store = syncMembers(ctx.org);
    const member = store.members.find((m) => m.userId === user.id)!;
    if (store.departments.some((d) => d.id === body.departmentId && d.tenantId === ctx.org.tenantId))
      bindDepartment(store, ctx, member, body.departmentId!);
    member.localRoleIds = (body.localRoleIds ?? []).filter((id) => store.roles.some((r) => r.id === id && r.tenantId === ctx.org.tenantId));
    saveStructure(store);
    changeUsersUsage(ctx.org.tenantId, 1);
    return HttpResponse.json(toMember(member, ctx.org, loadUsers(), ctx.user.id), { status: 201 });
  }),

  http.put('/api/tenant/members/:id', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_users.edit');
    if (ctx instanceof Response) return ctx;
    const store = syncMembers(ctx.org, true);
    const member = store.members.find((m) => m.id === params.id && m.tenantId === ctx.org.tenantId);
    if (!member) return err(404, 'NOT_FOUND');
    const body = (await request.json().catch(() => ({}))) as Partial<OrgMemberPayload>;
    const users = loadUsers();
    const user = users.find((u) => u.id === member.userId)!;
    const fe = validateUserProfile(body, users, { passwordRequired: false, selfId: user.id });
    if (!SYSTEM_ORG_ROLES.includes(body.role as SystemOrgRole)) fe.role = 'Выберите роль';
    if (user.id === ctx.user.id && body.role !== orgRoleOf(user, ctx.org.clientSlug)) fe.role = 'Нельзя изменить собственную роль';
    if (body.departmentId && !store.departments.some((d) => d.id === body.departmentId && d.tenantId === ctx.org.tenantId))
      fe.departmentId = 'Отдел не найден';
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);
    const previous = orgRoleOf(user, ctx.org.clientSlug);
    Object.assign(user, profileFields(body));
    if (body.password) user.passwordHash = hashPassword(body.password);
    // Основная роль заменяется; кастомные глобальные роли сохраняются
    user.roles = [
      ...user.roles.filter((r) => !(r.clientSlug === ctx.org.clientSlug && r.role === previous)),
      { role: body.role as SystemOrgRole, clientSlug: ctx.org.clientSlug },
    ];
    saveUsers(users);
    member.fullName = fullNameOf(user);
    member.email = user.email;
    bindDepartment(store, ctx, member, body.departmentId ?? null);
    member.localRoleIds = (body.localRoleIds ?? []).filter((id) => store.roles.some((r) => r.id === id && r.tenantId === ctx.org.tenantId));
    saveStructure(store);
    return HttpResponse.json(toMember(member, ctx.org, users, ctx.user.id));
  }),

  http.put('/api/tenant/members/:id/active', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_users.deactivate');
    if (ctx instanceof Response) return ctx;
    const store = syncMembers(ctx.org, true);
    const member = store.members.find((m) => m.id === params.id && m.tenantId === ctx.org.tenantId);
    if (!member) return err(404, 'NOT_FOUND');
    const { active } = (await request.json().catch(() => ({}))) as { active?: boolean };
    if (member.userId === ctx.user.id) return err(400, 'VALIDATION_ERROR', 'Нельзя деактивировать собственную учётную запись.');
    if (Boolean(active) !== member.active) {
      if (active && usersLimitReached(ctx.org)) return limitError();
      member.active = Boolean(active);
      saveStructure(store);
      changeUsersUsage(ctx.org.tenantId, active ? 1 : -1);
    }
    return HttpResponse.json(toMember(member, ctx.org, loadUsers(), ctx.user.id));
  }),

  // ---------- Отделы ----------
  http.get('/api/tenant/departments', async ({ request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_departments.view');
    if (ctx instanceof Response) return ctx;
    const store = syncMembers(ctx.org, true);
    return HttpResponse.json(store.departments.filter((d) => d.tenantId === ctx.org.tenantId).map((d) => toDepartment(d.id, store)));
  }),

  http.post('/api/tenant/departments', async ({ request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_departments.create_structure');
    if (ctx instanceof Response) return ctx;
    const store = loadStructure();
    const body = (await request.json().catch(() => ({}))) as Partial<OrgDepartmentPayload>;
    const fe = validateDepartment(body, ctx.org, store);
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);
    const id = crypto.randomUUID();
    store.departments.push({
      id,
      tenantId: ctx.org.tenantId,
      name: body.name!.trim(),
      kind: body.kind!,
      parentId: body.parentId ?? null,
      headMemberId: body.headMemberId ?? null,
    });
    saveStructure(store);
    return HttpResponse.json(toDepartment(id, store), { status: 201 });
  }),

  http.put('/api/tenant/departments/:id', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_departments.edit');
    if (ctx instanceof Response) return ctx;
    const store = loadStructure();
    const dept = store.departments.find((d) => d.id === params.id && d.tenantId === ctx.org.tenantId);
    if (!dept) return err(404, 'NOT_FOUND');
    const body = (await request.json().catch(() => ({}))) as Partial<OrgDepartmentPayload>;
    const fe = validateDepartment(body, ctx.org, store, dept.id);
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);
    Object.assign(dept, { name: body.name!.trim(), kind: body.kind!, parentId: body.parentId ?? null, headMemberId: body.headMemberId ?? null });
    saveStructure(store);
    return HttpResponse.json(toDepartment(dept.id, store));
  }),

  http.delete('/api/tenant/departments/:id', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_departments.delete');
    if (ctx instanceof Response) return ctx;
    const store = loadStructure();
    const dept = store.departments.find((d) => d.id === params.id && d.tenantId === ctx.org.tenantId);
    if (!dept) return err(404, 'NOT_FOUND');
    if (store.departments.some((d) => d.parentId === dept.id))
      return err(400, 'VALIDATION_ERROR', 'Сначала удалите или перенесите вложенные подразделения.');
    store.departments = store.departments.filter((d) => d.id !== dept.id);
    store.members.filter((m) => m.departmentId === dept.id).forEach((m) => bindDepartment(store, ctx, m, null));
    store.roles
      .filter((r) => r.departmentId === dept.id)
      .forEach((r) => {
        r.departmentId = null;
        if (r.scope === 'DEPARTMENT') r.scope = 'MEMBERS';
      });
    saveStructure(store);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('/api/tenant/departments/:id/members', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_departments.bind_users');
    if (ctx instanceof Response) return ctx;
    const store = syncMembers(ctx.org, true);
    const dept = store.departments.find((d) => d.id === params.id && d.tenantId === ctx.org.tenantId);
    if (!dept) return err(404, 'NOT_FOUND');
    const { memberIds } = (await request.json().catch(() => ({}))) as { memberIds?: string[] };
    store.members
      .filter((m) => m.tenantId === ctx.org.tenantId && memberIds?.includes(m.id))
      .forEach((m) => bindDepartment(store, ctx, m, dept.id));
    saveStructure(store);
    return new HttpResponse(null, { status: 204 });
  }),

  // ---------- Роли и доступы ----------
  http.get('/api/tenant/local-roles', async ({ request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_roles.view');
    if (ctx instanceof Response) return ctx;
    const store = syncMembers(ctx.org, true);
    const allowed = delegable(ctx.org);
    const users = loadUsers();
    const systemRoles: TenantRole[] = loadRoles()
      .filter((r) => SYSTEM_ORG_ROLES.includes(r.systemRole as SystemOrgRole))
      .sort((a, b) => SYSTEM_ORG_ROLES.indexOf(a.systemRole as SystemOrgRole) - SYSTEM_ORG_ROLES.indexOf(b.systemRole as SystemOrgRole))
      .map((r) => ({
        id: SYSTEM_ROLE_CODE[r.systemRole!],
        nameRu: r.name,
        nameKz: r.name,
        description: r.description,
        isSystem: true,
        matrix: r.matrix.filter((k) => allowed.includes(k)),
        scope: null,
        departmentId: null,
        memberIds: [],
        employeesCount: users.filter((u) => u.roles.some((x) => x.role === r.systemRole && x.clientSlug === ctx.org.clientSlug)).length,
      }));
    return HttpResponse.json({
      roles: [...systemRoles, ...store.roles.filter((r) => r.tenantId === ctx.org.tenantId).map((r) => toTenantRole(r, store, allowed))],
      catalog: pruneCatalog(allowed),
    });
  }),

  http.post('/api/tenant/local-roles', async ({ request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_roles.create');
    if (ctx instanceof Response) return ctx;
    const body = (await request.json().catch(() => ({}))) as Partial<TenantRolePayload>;
    const { fe, matrix } = validateRole(body, ctx);
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте настройки роли.', fe);
    const store = syncMembers(ctx.org, true);
    const role: LocalRole = {
      id: crypto.randomUUID(),
      tenantId: ctx.org.tenantId,
      name: body.nameRu!.trim(),
      nameKz: body.nameKz!.trim(),
      description: (body.description ?? '').trim(),
      scope: body.scope!,
      departmentId: body.scope === 'DEPARTMENT' ? body.departmentId! : null,
      matrix,
      createdAt: new Date().toISOString(),
    };
    store.roles.push(role);
    applyRoleMembers(store, role, ctx.org, body.memberIds ?? []);
    addAudit(store, ctx.org, ctx.user.id, 'ROLE_CREATED', role.name, [
      { field: 'Название', oldValue: null, newValue: role.name },
      { field: 'Отдел', oldValue: null, newValue: store.departments.find((d) => d.id === role.departmentId)?.name ?? null },
      { field: 'Включены опции', oldValue: null, newValue: matrix.join(', ') || null },
    ]);
    saveStructure(store);
    return HttpResponse.json(toTenantRole(role, store, delegable(ctx.org)), { status: 201 });
  }),

  http.put('/api/tenant/local-roles/:id', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_roles.edit');
    if (ctx instanceof Response) return ctx;
    const store = syncMembers(ctx.org, true);
    const role = store.roles.find((r) => r.id === params.id && r.tenantId === ctx.org.tenantId);
    if (!role) return err(404, 'NOT_FOUND');
    const body = (await request.json().catch(() => ({}))) as Partial<TenantRolePayload>;
    const { fe, matrix } = validateRole(body, ctx, role.id);
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте настройки роли.', fe);
    const removed = role.matrix.filter((k) => !matrix.includes(k));
    const added = matrix.filter((k) => !role.matrix.includes(k));
    Object.assign(role, {
      name: body.nameRu!.trim(),
      nameKz: body.nameKz!.trim(),
      description: (body.description ?? '').trim(),
      scope: body.scope!,
      departmentId: body.scope === 'DEPARTMENT' ? body.departmentId! : null,
      matrix,
    });
    applyRoleMembers(store, role, ctx.org, body.memberIds ?? []);
    if (removed.length || added.length)
      addAudit(store, ctx.org, ctx.user.id, 'ROLE_MATRIX_CHANGED', role.name, [
        { field: 'Выключены опции', oldValue: removed.join(', ') || null, newValue: null },
        { field: 'Включены опции', oldValue: null, newValue: added.join(', ') || null },
      ]);
    saveStructure(store);
    return HttpResponse.json(toTenantRole(role, store, delegable(ctx.org)));
  }),

  http.delete('/api/tenant/local-roles/:id', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_roles.delete');
    if (ctx instanceof Response) return ctx;
    const store = loadStructure();
    const role = store.roles.find((r) => r.id === params.id && r.tenantId === ctx.org.tenantId);
    if (!role) return err(404, 'NOT_FOUND');
    store.roles = store.roles.filter((r) => r.id !== role.id);
    store.members.forEach((m) => (m.localRoleIds = m.localRoleIds.filter((id) => id !== role.id)));
    addAudit(store, ctx.org, ctx.user.id, 'ROLE_DELETED', role.name, [
      { field: 'Название', oldValue: role.name, newValue: null },
      { field: 'Включены опции', oldValue: role.matrix.join(', ') || null, newValue: null },
    ]);
    saveStructure(store);
    return new HttpResponse(null, { status: 204 });
  }),

  // ---------- Группы ----------
  http.get('/api/tenant/groups', async ({ request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_groups.view');
    if (ctx instanceof Response) return ctx;
    return HttpResponse.json(loadStructure().groups.filter((g) => g.tenantId === ctx.org.tenantId).map((g) => toGroup(g, ctx.org)));
  }),

  http.post('/api/tenant/groups', async ({ request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_groups.create');
    if (ctx instanceof Response) return ctx;
    const body = (await request.json().catch(() => ({}))) as Partial<OrgGroupPayload>;
    const fe = validateGroup(body, ctx.org);
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);
    const store = loadStructure();
    const group = {
      id: crypto.randomUUID(),
      tenantId: ctx.org.tenantId,
      ...groupFields(body),
      courseTitle: null,
      listenerIds: [],
      createdAt: new Date().toISOString(),
    };
    store.groups.push(group);
    saveStructure(store);
    return HttpResponse.json(toGroup(group, ctx.org), { status: 201 });
  }),

  http.put('/api/tenant/groups/:id', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_groups.edit');
    if (ctx instanceof Response) return ctx;
    const store = loadStructure();
    const group = store.groups.find((g) => g.id === params.id && g.tenantId === ctx.org.tenantId);
    if (!group) return err(404, 'NOT_FOUND');
    const body = (await request.json().catch(() => ({}))) as Partial<OrgGroupPayload>;
    const fe = validateGroup(body, ctx.org);
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);
    Object.assign(group, groupFields(body));
    saveStructure(store);
    return HttpResponse.json(toGroup(group, ctx.org));
  }),

  http.delete('/api/tenant/groups/:id', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_groups.delete');
    if (ctx instanceof Response) return ctx;
    const store = loadStructure();
    if (!store.groups.some((g) => g.id === params.id && g.tenantId === ctx.org.tenantId)) return err(404, 'NOT_FOUND');
    store.groups = store.groups.filter((g) => g.id !== params.id);
    saveStructure(store);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('/api/tenant/groups/:id/listeners', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_groups.add_members_manual');
    if (ctx instanceof Response) return ctx;
    const store = syncMembers(ctx.org, true);
    const group = store.groups.find((g) => g.id === params.id && g.tenantId === ctx.org.tenantId);
    if (!group) return err(404, 'NOT_FOUND');
    const { memberIds } = (await request.json().catch(() => ({}))) as { memberIds?: string[] };
    const valid = store.members.filter((m) => m.tenantId === ctx.org.tenantId && m.active && memberIds?.includes(m.id)).map((m) => m.id);
    group.listenerIds = [...new Set([...group.listenerIds, ...valid])];
    saveStructure(store);
    return HttpResponse.json(toGroup(group, ctx.org));
  }),

  http.delete('/api/tenant/groups/:id/listeners/:memberId', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_groups.add_members_manual');
    if (ctx instanceof Response) return ctx;
    const store = loadStructure();
    const group = store.groups.find((g) => g.id === params.id && g.tenantId === ctx.org.tenantId);
    if (!group) return err(404, 'NOT_FOUND');
    group.listenerIds = group.listenerIds.filter((id) => id !== params.memberId);
    saveStructure(store);
    return HttpResponse.json(toGroup(group, ctx.org));
  }),

  // ---------- Конструктор отчётов ----------
  http.get('/api/tenant/reports/:type', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_report_builder.builder_basic');
    if (ctx instanceof Response) return ctx;
    const type = String(params.type) as ReportType;
    if (!(type in REPORT_TITLE)) return err(400, 'VALIDATION_ERROR', 'Неизвестный тип отчёта.');
    const url = new URL(request.url);
    return HttpResponse.json(buildReport(type, ctx.org, { groupId: url.searchParams.get('groupId'), courseId: url.searchParams.get('courseId') }));
  }),

  // ---------- Учебные программы: изменение и удаление ----------
  http.patch('/api/tenant/courses/:id', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_prog_core.edit');
    if (ctx instanceof Response) return ctx;
    const body = (await request.json().catch(() => ({}))) as { title?: string; category?: string };
    const title = (body.title ?? '').trim();
    if (title.length < 3 || title.length > 120)
      return err(400, 'VALIDATION_ERROR', 'Название курса — от 3 до 120 символов', { title: 'Название курса — от 3 до 120 символов' });
    const course = updateCourse(ctx.org, String(params.id), { title, category: body.category || 'Без категории' });
    return course ? HttpResponse.json(course) : err(404, 'NOT_FOUND');
  }),

  http.delete('/api/tenant/courses/:id', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_prog_core.delete');
    if (ctx instanceof Response) return ctx;
    if (!removeCourse(ctx.org, String(params.id))) return err(404, 'NOT_FOUND');
    removeCourseContent(String(params.id));
    const store = loadStructure();
    store.groups.filter((g) => g.courseId === params.id).forEach((g) => (g.courseId = null));
    saveStructure(store);
    const db = load();
    const org = db.organizations.find((o) => o.tenantId === ctx.org.tenantId)!;
    org.usage.COURSES_COUNT = courseCount(ctx.org);
    save(db);
    return new HttpResponse(null, { status: 204 });
  }),
];

function toDepartment(id: string, store: ReturnType<typeof loadStructure>) {
  const d = store.departments.find((x) => x.id === id)!;
  return {
    id: d.id,
    parentId: d.parentId,
    name: d.name,
    kind: d.kind,
    headMemberId: d.headMemberId,
    headName: store.members.find((m) => m.id === d.headMemberId)?.fullName ?? null,
    membersCount: store.members.filter((m) => m.departmentId === d.id).length,
  };
}

function validateDepartment(
  body: Partial<OrgDepartmentPayload>,
  org: OrgRecord,
  store: ReturnType<typeof loadStructure>,
  selfId?: string,
): Record<string, string> {
  const fe: Record<string, string> = {};
  const name = (body.name ?? '').trim();
  if (name.length < 2 || name.length > 120) fe.name = 'Название — от 2 до 120 символов';
  if (!KINDS.includes(body.kind as DepartmentKind)) fe.kind = 'Выберите тип подразделения';
  if (body.parentId) {
    const own = store.departments.filter((d) => d.tenantId === org.tenantId);
    if (!own.some((d) => d.id === body.parentId)) fe.parentId = 'Подразделение не найдено';
    // Подразделение нельзя вложить в себя или в своего потомка
    for (let cur: string | null | undefined = body.parentId; cur; cur = own.find((d) => d.id === cur)?.parentId)
      if (cur === selfId) fe.parentId = 'Нельзя вложить подразделение в самого себя';
  }
  if (body.headMemberId && !store.members.some((m) => m.id === body.headMemberId && m.tenantId === org.tenantId))
    fe.headMemberId = 'Сотрудник не найден';
  return fe;
}

