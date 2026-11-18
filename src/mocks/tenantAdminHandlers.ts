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
  GroupFormOptions,
  GroupListener,
  GroupStatus,
  OrgGroup,
  ProgramPayload,
  OrgGroupPayload,
  OrgMember,
  OrgMemberPayload,
  OrgTrainer,
  TrainerCandidate,
  PaymentPeriod,
  RegistryModule,
  RegistryOption,
  ReportResult,
  ReportType,
  SystemOrgRole,
  TenantRole,
  TenantRolePayload,
  ShowcaseApplicationPayload,
  ShowcaseCourse,
} from '@/api/types';
import { EMAIL_PATTERN, isValidKzPhone, phoneDigits } from '@/features/auth/validation';
import { inTariff, TARIFF_MODULE_OF } from '@/shared/access';
import { finalPrice, planAmount } from '@/shared/pricing';
import { richTextToPlain, sanitizeRichText } from '@/shared/richText';
import { computeStatus, effectiveLimitValues, effectiveModules, getSession, load, MODULES, save, type OrgRecord } from './db';
import { addCourse, courseCount, findCourse, listCourses, removeCourse, updateCourse } from './content';
import { removeCourseContent } from './courseBuilder';
import { err, latency, profileFields, publishChanges, recordSubscriptionChange, subscriptionGuard, tenantContext, validateUserProfile } from './handlers';
import { addAudit, loadStructure, nextIin, roleHolders, saveStructure, syncMembers, type GroupRecord, type LocalRole, type Member, type TrainerEntry } from './orgStructure';
import { canContinue, currentMonths, markPaid, newSchedule, planFor, scheduleEndDate } from './paymentSchedule';
import { publish } from './eventBus';
import { isVisibleItem, itemName } from './directories';
import { loadRegistry } from './registry';
import { loadRoles, matrixOf, SYSTEM_ROLE_CODE } from './roles';
import { ensureDefaultScheme, schemesForTenant } from './profileFields';
import { accessFor, fullNameOf, hashPassword, loadUsers, saveUsers, type UserRecord } from './users';

const SYSTEM_ORG_ROLES: SystemOrgRole[] = ['ORGANIZATION_ADMIN', 'TRAINER', 'LEARNER'];
const KINDS: DepartmentKind[] = ['DEPARTMENT', 'MANAGEMENT', 'BRANCH', 'UNIT'];
const USERS_LIMIT = 'USERS_COUNT';

type Ctx = { org: OrgRecord; user: CurrentUser };

const ROLE_TITLE: Record<SystemOrgRole, string> = { ORGANIZATION_ADMIN: 'Администратор организации', TRAINER: 'Тренер', LEARNER: 'Слушатель' };
const yesNo = (value: boolean) => (value ? 'Активен' : 'Деактивирован');

/** Привязка схемы анкеты к группе: модуль «Конструктор полей профиля» и опция в итоговом доступе */
const canAttachScheme = (user: CurrentUser) => user.access.includes('lms_profile_field_builder.attach_to_group');

/** Без права привязки группа сохраняет текущую схему, новая получает основную */
function schemeFor(body: Partial<OrgGroupPayload>, ctx: Ctx, current?: GroupRecord) {
  if (canAttachScheme(ctx.user)) return body.profileSchemeId ?? null;
  return current?.profileSchemeId ?? ensureDefaultScheme(ctx.org.tenantId).id;
}

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
    positionId: m.positionId ?? null,
    positionName: itemName(m.positionId),
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

function bindDepartment(store: ReturnType<typeof loadStructure>, ctx: Ctx, request: Request, m: Member, departmentId: string | null) {
  if (m.departmentId === departmentId) return;
  const previous = store.departments.find((d) => d.id === m.departmentId);
  const next = store.departments.find((d) => d.id === departmentId);
  m.departmentId = departmentId;
  addAudit(store, ctx.org, ctx.user, request, 'USER_BOUND_TO_DEPARTMENT', m.fullName, [
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

/** Рабочий режим: глобальная роль администратора ∩ тариф */
const delegable = (org: OrgRecord) => accessFor({ role: 'ORGANIZATION_ADMIN', clientSlug: org.clientSlug });

/** Ближайший тариф дороже текущего, в который входит модуль */
export function upgradeTariffFor(org: OrgRecord, code: string): { id: string; name: string } | null {
  const tariffs = [...load().tariffs].sort((a, b) => a.annualPrice - b.annualPrice);
  const current = tariffs.find((t) => t.id === org.tariffPlanId);
  const target = tariffs.find((t) => t.modules[code] && t.annualPrice > (current?.annualPrice ?? 0));
  return target ? { id: target.id, name: target.name } : null;
}

/** Модули реестра вне тарифа организации */
function demoModulesOf(org: OrgRecord): Record<string, string | null> {
  const enabled = effectiveModules(org);
  return Object.fromEntries(
    loadRegistry()
      .filter((m) => !inTariff(m.key, enabled))
      .map((m) => {
        const code = TARIFF_MODULE_OF[m.key];
        return [m.key, code ? (upgradeTariffFor(org, code)?.name ?? null) : null];
      }),
  );
}

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
    matrix: r.matrix,
    demoOptions: r.matrix.filter((k) => !allowed.includes(k)).length,
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
  // Тариф не ограничивает выбор: опции вне тарифа работают в демо-режиме до перехода на нужный тариф
  const allowed = matrixOf('ORGANIZATION_ADMIN');
  const denied = matrix.filter((k) => !allowed.includes(k));
  if (denied.length) fe.matrix = `Опции не разрешены глобальной ролью администратора: ${denied.slice(0, 3).join(', ')}`;
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

// ---------- учебные программы ----------

const LANG_FIELDS = ['Kz', 'Ru', 'En'] as const;

function validateProgram(
  body: Partial<ProgramPayload> & { formatId?: string | null; assessmentId?: string | null },
  org: OrgRecord,
): { fe: Record<string, string>; fields: ProgramPayload } {
  const fe: Record<string, string> = {};
  const text = (k: keyof ProgramPayload) => {
    const v = body[k];
    return typeof v === 'string' ? v.trim() : '';
  };
  // Описание, цель и ожидаемый результат — форматированный текст
  const description = (k: keyof ProgramPayload) => sanitizeRichText(text(k));
  const fields: ProgramPayload = {
    titleKz: text('titleKz'),
    titleRu: text('titleRu'),
    titleEn: text('titleEn'),
    descriptionKz: description('descriptionKz'),
    descriptionRu: description('descriptionRu'),
    descriptionEn: description('descriptionEn'),
    goalKz: description('goalKz'),
    goalRu: description('goalRu'),
    goalEn: description('goalEn'),
    resultKz: description('resultKz'),
    resultRu: description('resultRu'),
    resultEn: description('resultEn'),
    formatIds: Array.isArray(body.formatIds) ? [...new Set(body.formatIds)] : body.formatId ? [body.formatId] : [],
    assessmentIds: Array.isArray(body.assessmentIds) ? [...new Set(body.assessmentIds)] : body.assessmentId ? [body.assessmentId] : [],
    hoursTheory: body.hoursTheory ?? null,
    hoursPractice: body.hoursPractice ?? null,
    coverUrl: body.coverUrl ?? null,
  };
  // Все три языка — казахский, русский и английский — обязательны
  for (const l of LANG_FIELDS) {
    const label = l === 'Kz' ? 'на казахском' : l === 'Ru' ? 'на русском' : 'на английском';
    const title = fields[`title${l}`];
    if (!title || title.length > 200) fe[`title${l}`] = `Название ${label} — от 1 до 200 символов`;
    const plain = richTextToPlain(fields[`description${l}`]);
    if (!plain) fe[`description${l}`] = `Заполните описание ${label}`;
    if (plain.length > 20000) fe[`description${l}`] = 'Не более 20 000 символов';
    for (const [k, name] of [['goal', 'цель программы'], ['result', 'ожидаемый результат']] as const) {
      const v = richTextToPlain(fields[`${k}${l}`]);
      if (!v) fe[`${k}${l}`] = `Заполните ${name} ${label}`;
      if (v.length > 2000) fe[`${k}${l}`] = 'Не более 2000 символов';
    }
  }
  if (!fields.formatIds.length) fe.formatIds = 'Выберите хотя бы один формат курса';
  else if (fields.formatIds.some((id) => !isVisibleItem(id, 'course_format', org.tenantId))) fe.formatIds = 'Значение справочника недоступно';
  if (!fields.assessmentIds.length) fe.assessmentIds = 'Выберите хотя бы один тип оценивания';
  else if (fields.assessmentIds.some((id) => !isVisibleItem(id, 'course_assessment', org.tenantId))) fe.assessmentIds = 'Значение справочника недоступно';
  for (const k of ['hoursTheory', 'hoursPractice'] as const) {
    const v = fields[k];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 100000) fe[k] = 'Целое положительное число';
  }
  const cover = fields.coverUrl;
  if (cover && (!/^data:image\/(jpeg|png|webp);base64,/.test(cover) || cover.length > 7_000_000)) fe.coverUrl = 'JPG, PNG или WebP, до 5 МБ';
  return { fe, fields };
}

// ---------- группы ----------

const STATUSES: GroupStatus[] = ['RECRUITING', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'];

/** Учебные годы для выбора: прошлый, текущий и два следующих */
function academicYears(): string[] {
  const now = dayjs();
  // Учебный год начинается 1 сентября
  const start = now.month() >= 8 ? now.year() : now.year() - 1;
  return [-1, 0, 1, 2].map((d) => `${start + d}–${start + d + 1}`);
}

const YEAR = /^(\d{4})–(\d{4})$/;
const HASH = /^[a-f0-9]{32}$/;
const newInviteHash = () => crypto.randomUUID().replace(/-/g, '');

function toGroup(g: GroupRecord, org: OrgRecord, user: CurrentUser): OrgGroup {
  const store = loadStructure();
  const users = loadUsers();
  const trainers = g.trainerIds.flatMap((id) => {
    const t = store.trainers.find((x) => x.id === id && x.tenantId === org.tenantId);
    const u = t && users.find((x) => x.id === t.userId);
    return t && u ? [{ id, name: fullNameOf(u) }] : [];
  });
  const canInvite = user.access.includes('lms_groups.invite_link');
  return {
    id: g.id,
    name: g.name,
    academicYear: g.academicYear,
    departmentId: g.departmentId,
    departmentName: store.departments.find((d) => d.id === g.departmentId)?.name ?? null,
    formatId: g.formatId,
    formatName: itemName(g.formatId),
    assessmentId: g.assessmentId ?? null,
    assessmentName: itemName(g.assessmentId),
    courseId: g.courseId,
    courseTitle: g.courseId ? (findCourse(org, g.courseId)?.title ?? null) : null,
    profileSchemeId: g.profileSchemeId ?? schemesForTenant(org.tenantId)[0]!.id,
    profileSchemeName: schemesForTenant(org.tenantId).find((s) => s.id === g.profileSchemeId)?.name ?? schemesForTenant(org.tenantId)[0]!.name,
    trainerIds: trainers.map((t) => t.id),
    trainerNames: trainers.map((t) => t.name),
    listenersLimit: g.listenersLimit,
    startDate: g.startDate,
    endDate: g.endDate,
    status: g.status,
    inviteHash: canInvite ? g.inviteHash : null,
    inviteUrl: canInvite ? `https://${org.clientSlug}.beyim.kz/invite/group/${g.inviteHash}` : null,
    listenerIds: g.listenerIds,
    newApplicationsCount: user.access.includes('lms_showcase_applications.view')
      ? store.applications.filter((application) => application.groupId === g.id && application.status === 'NEW').length
      : 0,
    createdAt: g.createdAt,
  };
}

function validateGroup(body: Partial<OrgGroupPayload>, org: OrgRecord, current?: GroupRecord): Record<string, string> {
  const store = loadStructure();
  const fe: Record<string, string> = {};
  const year = YEAR.exec(body.academicYear ?? '');
  if (!year || Number(year[2]) !== Number(year[1]) + 1) fe.academicYear = 'Выберите учебный год';
  if (body.departmentId && !store.departments.some((d) => d.id === body.departmentId && d.tenantId === org.tenantId)) fe.departmentId = 'Подразделение не найдено';
  if (!body.formatId) fe.formatId = 'Выберите формат курса';
  else if (!isVisibleItem(body.formatId, 'course_format', org.tenantId)) fe.formatId = 'Значение справочника недоступно';
  if (!body.assessmentId) fe.assessmentId = 'Выберите тип оценивания';
  else if (!isVisibleItem(body.assessmentId, 'course_assessment', org.tenantId)) fe.assessmentId = 'Значение справочника недоступно';
  if (!body.courseId) fe.courseId = 'Выберите учебную программу';
  else if (!findCourse(org, body.courseId)) fe.courseId = 'Программа не найдена';
  if (!body.profileSchemeId || !schemesForTenant(org.tenantId).some((s) => s.id === body.profileSchemeId)) fe.profileSchemeId = 'Выберите схему анкеты слушателя';
  const trainerIds = body.trainerIds ?? [];
  if (new Set(trainerIds).size !== trainerIds.length) fe.trainerIds = 'Тренер выбран несколько раз';
  // Уже назначенный и позже деактивированный тренер остаётся; нового можно выбрать только из активных
  const invalid = trainerIds.some((id) => {
    const t = store.trainers.find((x) => x.id === id && x.tenantId === org.tenantId);
    return !t || (!t.active && !current?.trainerIds.includes(id));
  });
  if (invalid) fe.trainerIds = 'Выберите тренера из тренерского состава';
  const limit = body.listenersLimit;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 100000) fe.listenersLimit = 'Целое положительное число';
  else if (current && limit < current.listenerIds.length) fe.listenersLimit = `В группе уже ${current.listenerIds.length} слушателей`;
  if (!body.startDate || !dayjs(body.startDate).isValid()) fe.startDate = 'Укажите дату начала';
  if (!body.endDate || !dayjs(body.endDate).isValid()) fe.endDate = 'Укажите дату окончания';
  else if (body.startDate && body.endDate <= body.startDate) fe.endDate = 'Дата окончания должна быть строго позже даты начала';
  if (!STATUSES.includes(body.status as GroupStatus)) fe.status = 'Выберите статус';
  return fe;
}

/** Запись в журнал вне операций со структурой (программы) */
function auditOnly(ctx: Ctx, request: Request, event: Parameters<typeof addAudit>[4], target: string, changes: Parameters<typeof addAudit>[6]) {
  const store = loadStructure();
  addAudit(store, ctx.org, ctx.user, request, event, target, changes);
  saveStructure(store);
}

function groupChanges(before: GroupRecord | null, after: GroupRecord, org: OrgRecord) {
  const store = loadStructure();
  const users = loadUsers();
  const trainers = (g: GroupRecord | null) =>
    g
      ? g.trainerIds
          .map((id) => {
            const t = store.trainers.find((x) => x.id === id);
            const u = t && users.find((x) => x.id === t.userId);
            return u ? fullNameOf(u) : id;
          })
          .join(', ') || null
      : null;
  const course = (g: GroupRecord | null) => (g?.courseId ? (findCourse(org, g.courseId)?.title ?? g.courseId) : null);
  const scheme = (g: GroupRecord | null) => (g ? (schemesForTenant(org.tenantId).find((s) => s.id === g.profileSchemeId)?.name ?? null) : null);
  return [
    { field: 'Программа', oldValue: course(before), newValue: course(after) },
    { field: 'Учебный год', oldValue: before?.academicYear ?? null, newValue: after.academicYear },
    { field: 'Период', oldValue: before ? `${before.startDate} — ${before.endDate}` : null, newValue: `${after.startDate} — ${after.endDate}` },
    { field: 'Тренеры', oldValue: trainers(before), newValue: trainers(after) },
    { field: 'Лимит слушателей', oldValue: before ? String(before.listenersLimit) : null, newValue: String(after.listenersLimit) },
    { field: 'Статус', oldValue: before?.status ?? null, newValue: after.status },
    { field: 'Схема анкеты', oldValue: scheme(before), newValue: scheme(after) },
  ].filter((c) => c.oldValue !== c.newValue);
}

const groupFields = (b: Partial<OrgGroupPayload>) => ({
  academicYear: b.academicYear!,
  departmentId: b.departmentId || null,
  formatId: b.formatId!,
  assessmentId: b.assessmentId!,
  courseId: b.courseId!,
  profileSchemeId: b.profileSchemeId!,
  trainerIds: b.trainerIds ?? [],
  listenersLimit: b.listenersLimit!,
  startDate: b.startDate!,
  endDate: b.endDate!,
  status: b.status as GroupStatus,
});

const toListener = (m: Member, users: UserRecord[]): GroupListener => {
  const u = users.find((x) => x.id === m.userId);
  return { id: m.id, fullName: u ? fullNameOf(u) : m.fullName, iin: u?.iin ?? '', email: u?.email ?? m.email };
};

function trainerNames(group: GroupRecord, store: ReturnType<typeof loadStructure>) {
  const users = loadUsers();
  return group.trainerIds.flatMap((id) => {
    const trainer = store.trainers.find((item) => item.id === id);
    const user = trainer && users.find((item) => item.id === trainer.userId);
    return user ? [fullNameOf(user)] : [];
  });
}

function showcaseCourses(org: OrgRecord): ShowcaseCourse[] {
  const store = loadStructure();
  return listCourses(org)
    .filter((course) => course.status === 'PUBLISHED')
    .flatMap((course) => {
      const groups = store.groups
        .filter((group) => group.tenantId === org.tenantId && group.courseId === course.id && group.status === 'RECRUITING')
        .map((group) => ({
          id: group.id,
          name: group.name,
          startDate: group.startDate,
          endDate: group.endDate,
          trainerNames: trainerNames(group, store),
          placesLeft: Math.max(0, group.listenersLimit - group.listenerIds.length),
        }));
      if (!groups.length) return [];
      return [{
        id: course.id,
        organizationName: org.name,
        clientSlug: org.clientSlug,
        title: course.titleRu || course.title,
        description: richTextToPlain(course.descriptionRu),
        coverUrl: course.coverUrl,
        formatName: itemName(course.formatIds[0]),
        hoursTheory: course.hoursTheory,
        hoursPractice: course.hoursPractice,
        teacher: course.teacher,
        groups,
      }];
    });
}

function addUserToGroup(org: OrgRecord, group: GroupRecord, user: UserRecord) {
  if (!user.roles.some((role) => role.role === 'LEARNER' && role.clientSlug === org.clientSlug)) {
    user.roles.push({ role: 'LEARNER', clientSlug: org.clientSlug });
    const users = loadUsers().map((item) => (item.id === user.id ? user : item));
    saveUsers(users);
  }
  const store = syncMembers(org);
  const storedGroup = store.groups.find((item) => item.id === group.id && item.tenantId === org.tenantId)!;
  const member = store.members.find((item) => item.userId === user.id && item.tenantId === org.tenantId)!;
  member.active = true;
  if (!storedGroup.listenerIds.includes(member.id)) {
    if (storedGroup.listenerIds.length >= storedGroup.listenersLimit) return false;
    storedGroup.listenerIds.push(member.id);
  }
  saveStructure(store);
  return true;
}

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

function buildReport(type: ReportType, org: OrgRecord, f: { groupId: string | null; courseId: string | null; positionId: string | null }): ReportResult {
  const store = syncMembers(org);
  const group = store.groups.find((g) => g.id === f.groupId && g.tenantId === org.tenantId);
  const members = store.members.filter(
    (m) => m.tenantId === org.tenantId && m.active && (!group || group.listenerIds.includes(m.id)) && (!f.positionId || m.positionId === f.positionId),
  );
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
  http.get('/api/public/showcase', async ({ request }) => {
    await latency();
    const clientSlug = new URL(request.url).searchParams.get('clientSlug') ?? '';
    const org = load().organizations.find((item) => item.clientSlug === clientSlug);
    if (!org || computeStatus(org) !== 'ACTIVE' || !effectiveModules(org).includes('COURSE_SHOWCASE')) return err(404, 'NOT_FOUND');
    return HttpResponse.json(showcaseCourses(org));
  }),

  http.get('/api/public/showcase/:courseId', async ({ params, request }) => {
    await latency();
    const clientSlug = new URL(request.url).searchParams.get('clientSlug') ?? '';
    const org = load().organizations.find((item) => item.clientSlug === clientSlug);
    if (!org || computeStatus(org) !== 'ACTIVE' || !effectiveModules(org).includes('COURSE_SHOWCASE')) return err(404, 'NOT_FOUND');
    const course = showcaseCourses(org).find((item) => item.id === params.courseId);
    return course ? HttpResponse.json(course) : err(404, 'NOT_FOUND');
  }),

  http.post('/api/public/showcase/groups/:groupId/applications', async ({ params, request }) => {
    await latency();
    const clientSlug = new URL(request.url).searchParams.get('clientSlug') ?? '';
    const org = load().organizations.find((item) => item.clientSlug === clientSlug);
    if (!org || computeStatus(org) !== 'ACTIVE' || !effectiveModules(org).includes('COURSE_SHOWCASE')) return err(404, 'NOT_FOUND');
    const store = loadStructure();
    const group = store.groups.find((item) => item.id === params.groupId && item.tenantId === org.tenantId && item.status === 'RECRUITING');
    const course = group?.courseId && findCourse(org, group.courseId);
    if (!group || !course || course.status !== 'PUBLISHED') return err(404, 'NOT_FOUND');
    const body = (await request.json().catch(() => ({}))) as Partial<ShowcaseApplicationPayload>;
    const fullName = (body.fullName ?? '').trim();
    const email = (body.email ?? '').trim().toLowerCase();
    const phone = phoneDigits(body.phone ?? '');
    const fieldErrors: Record<string, string> = {};
    if (!fullName) fieldErrors.fullName = 'Укажите ФИО';
    if (!EMAIL_PATTERN.test(email)) fieldErrors.email = 'Укажите корректный Email';
    if (!isValidKzPhone(phone)) fieldErrors.phone = 'Укажите номер в формате +7 (7XX) XXX-XX-XX';
    if (Object.keys(fieldErrors).length) return err(400, 'VALIDATION_ERROR', 'Проверьте заполнение формы.', fieldErrors);
    if (group.listenerIds.length >= group.listenersLimit) return err(400, 'VALIDATION_ERROR', 'В группе нет свободных мест.');
    if (!effectiveModules(org).includes('SHOWCASE_APPLICATIONS')) {
      return HttpResponse.json({ delivery: 'EMAIL' as const }, { status: 201 });
    }
    store.applications.unshift({
      id: crypto.randomUUID(),
      tenantId: org.tenantId,
      groupId: group.id,
      courseId: course.id,
      fullName,
      email,
      phone,
      createdAt: new Date().toISOString(),
      status: 'NEW',
    });
    saveStructure(store);
    return HttpResponse.json({ delivery: 'REGISTRY' as const }, { status: 201 });
  }),

  http.post('/api/invite/group/:hash', async ({ params }) => {
    await latency();
    const session = getSession();
    if (!session) return err(401, 'UNAUTHORIZED');
    const store = loadStructure();
    const group = store.groups.find((item) => item.inviteHash === params.hash);
    const org = group && load().organizations.find((item) => item.tenantId === group.tenantId);
    const user = loadUsers().find((item) => item.id === session.id);
    if (!group || !org || !user) return err(404, 'NOT_FOUND');
    const courseTitle = group.courseId ? (findCourse(org, group.courseId)?.title ?? '') : '';
    if (!addUserToGroup(org, group, user)) return err(400, 'VALIDATION_ERROR', 'В группе нет свободных мест.');
    return HttpResponse.json({ groupName: group.name, courseTitle, enrolled: true });
  }),
  // ---------- Каталог модулей: рабочие и демо ----------
  http.get('/api/tenant/module-catalog', async ({ request }) => {
    await latency();
    const ctx = tenantContext(request);
    if (ctx instanceof Response) return ctx;
    const enabled = effectiveModules(ctx.org);
    // Демо-доступ — только у администратора организации: тренер, слушатель и другие сотрудники
    // видят лишь модули тарифа, закрытых модулей для них нет
    const isAdmin = ctx.user.role === 'ORGANIZATION_ADMIN';
    const result: CatalogModule[] = MODULES.filter((m) => isAdmin || enabled.includes(m.code)).map((m) => ({
      code: m.code,
      name: m.name,
      description: m.description,
      icon: m.icon,
      enabled: enabled.includes(m.code),
      upgradeTariff: upgradeTariffFor(ctx.org, m.code),
    }));
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
    if (body.positionId && !isVisibleItem(body.positionId, 'position', ctx.org.tenantId)) fe.positionId = 'Значение справочника недоступно';
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
      bindDepartment(store, ctx, request, member, body.departmentId!);
    member.localRoleIds = (body.localRoleIds ?? []).filter((id) => store.roles.some((r) => r.id === id && r.tenantId === ctx.org.tenantId));
    member.positionId = body.positionId ?? null;
    addAudit(store, ctx.org, ctx.user, request, 'USER_CREATED', fullNameOf(user), [
      { field: 'Роль', oldValue: null, newValue: ROLE_TITLE[body.role as SystemOrgRole] },
      { field: 'Email', oldValue: null, newValue: user.email },
    ]);
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
    if (body.positionId && !isVisibleItem(body.positionId, 'position', ctx.org.tenantId)) fe.positionId = 'Значение справочника недоступно';
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);
    const previous = orgRoleOf(user, ctx.org.clientSlug);
    const before = { name: fullNameOf(user), email: user.email, phone: user.phone };
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
    bindDepartment(store, ctx, request, member, body.departmentId ?? null);
    member.localRoleIds = (body.localRoleIds ?? []).filter((id) => store.roles.some((r) => r.id === id && r.tenantId === ctx.org.tenantId));
    member.positionId = body.positionId ?? null;
    const changes = [
      { field: 'ФИО', oldValue: before.name, newValue: fullNameOf(user) },
      { field: 'Email', oldValue: before.email, newValue: user.email },
      { field: 'Телефон', oldValue: before.phone, newValue: user.phone },
      { field: 'Роль', oldValue: previous ? ROLE_TITLE[previous] : null, newValue: ROLE_TITLE[body.role as SystemOrgRole] },
      ...(body.password ? [{ field: 'Пароль', oldValue: null, newValue: 'изменён' }] : []),
    ].filter((c) => c.oldValue !== c.newValue);
    if (changes.length) addAudit(store, ctx.org, ctx.user, request, 'USER_UPDATED', member.fullName, changes);
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
      addAudit(store, ctx.org, ctx.user, request, active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', member.fullName, [
        { field: 'Статус', oldValue: yesNo(!active), newValue: yesNo(Boolean(active)) },
      ]);
      saveStructure(store);
      changeUsersUsage(ctx.org.tenantId, active ? 1 : -1);
    }
    return HttpResponse.json(toMember(member, ctx.org, loadUsers(), ctx.user.id));
  }),

  // ---------- Тренерский состав ----------
  http.get('/api/tenant/trainers', async ({ request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_trainers.list_view');
    if (ctx instanceof Response) return ctx;
    const store = syncMembers(ctx.org);
    return HttpResponse.json(
      store.trainers
        .filter((t) => t.tenantId === ctx.org.tenantId)
        .map((t) => toTrainer(t, loadUsers()))
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru')),
    );
  }),

  // Поиск по общей базе платформы: без контактов, ИИН виден только при точном совпадении с запросом
  http.get('/api/tenant/trainers/search', async ({ request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_trainers.create');
    if (ctx instanceof Response) return ctx;
    const q = (new URL(request.url).searchParams.get('q') ?? '').trim().toLowerCase();
    if (q.length < 3) return HttpResponse.json([]);
    const trainers = syncMembers(ctx.org).trainers.filter((t) => t.tenantId === ctx.org.tenantId);
    const result: TrainerCandidate[] = loadUsers()
      .filter((u) => !u.roles.some((r) => r.role === 'SUPERADMIN'))
      .filter((u) => u.iin === q || fullNameOf(u).toLowerCase().includes(q))
      .slice(0, 10)
      .map((u) => ({
        userId: u.id,
        fullName: fullNameOf(u),
        iin: u.iin === q ? u.iin : `••••••••${u.iin.slice(-4)}`,
        alreadyTrainer: trainers.some((t) => t.userId === u.id),
      }));
    return HttpResponse.json(result);
  }),

  // Назначение не создаёт пользователя: существующая учётная запись получает привязку к организации
  http.post('/api/tenant/trainers', async ({ request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_trainers.create');
    if (ctx instanceof Response) return ctx;
    const { userId, categoryId } = (await request.json().catch(() => ({}))) as { userId?: string; categoryId?: string | null };
    if (categoryId && !isVisibleItem(categoryId, 'trainer_category', ctx.org.tenantId))
      return err(400, 'VALIDATION_ERROR', 'Значение справочника недоступно.');
    const users = loadUsers();
    const user = users.find((u) => u.id === userId && !u.roles.some((r) => r.role === 'SUPERADMIN'));
    if (!user) return err(404, 'NOT_FOUND', 'Пользователь не найден.');
    const slug = ctx.org.clientSlug;
    if (user.roles.some((r) => r.role === 'TRAINER' && r.clientSlug === slug))
      return err(400, 'VALIDATION_ERROR', 'Этот пользователь уже в тренерском составе организации.');
    const isNewMember = !user.roles.some((r) => r.clientSlug === slug);
    if (isNewMember && usersLimitReached(ctx.org)) return limitError();
    user.roles.push({ role: 'TRAINER', clientSlug: slug });
    // Личный кабинет Слушателя у сотрудника сохраняется
    if (!user.roles.some((r) => r.role === 'LEARNER')) user.roles.push({ role: 'LEARNER' });
    saveUsers(users);
    const store = syncMembers(ctx.org);
    if (isNewMember) changeUsersUsage(ctx.org.tenantId, 1);
    const trainer = store.trainers.find((t) => t.tenantId === ctx.org.tenantId && t.userId === user.id)!;
    trainer.categoryId = categoryId ?? null;
    addAudit(store, ctx.org, ctx.user, request, 'TRAINER_ADDED', fullNameOf(user), [
      { field: 'Категория', oldValue: null, newValue: categoryId ? (itemName(categoryId) ?? categoryId) : null },
      { field: 'Тренерский состав', oldValue: null, newValue: 'Добавлен' },
    ]);
    saveStructure(store);
    return HttpResponse.json(toTrainer(trainer, users), { status: 201 });
  }),

  // Деактивация сразу закрывает интерфейс тренера; учётная запись и личный кабинет сохраняются
  http.put('/api/tenant/trainers/:id/status', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_trainers.deactivate');
    if (ctx instanceof Response) return ctx;
    const store = syncMembers(ctx.org);
    const trainer = store.trainers.find((t) => t.id === params.id && t.tenantId === ctx.org.tenantId);
    if (!trainer) return err(404, 'NOT_FOUND');
    const { active } = (await request.json().catch(() => ({}))) as { active?: boolean };
    if (trainer.active !== Boolean(active)) {
      const trainerUser = loadUsers().find((u) => u.id === trainer.userId);
      addAudit(store, ctx.org, ctx.user, request, active ? 'TRAINER_ACTIVATED' : 'TRAINER_DEACTIVATED', trainerUser ? fullNameOf(trainerUser) : trainer.id, [
        { field: 'Статус', oldValue: yesNo(trainer.active), newValue: yesNo(Boolean(active)) },
      ]);
    }
    trainer.active = Boolean(active);
    saveStructure(store);
    publish({
      type: 'permissions.updated',
      tenantId: ctx.org.tenantId,
      version: ctx.org.version,
      changed: ['permissions'],
      occurredAt: new Date().toISOString(),
    });
    return HttpResponse.json(toTrainer(trainer, loadUsers()));
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
    addAudit(store, ctx.org, ctx.user, request, 'DEPARTMENT_CREATED', body.name!.trim(), [
      { field: 'Название', oldValue: null, newValue: body.name!.trim() },
      { field: 'Тип', oldValue: null, newValue: body.kind! },
    ]);
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
    const before = { ...dept };
    Object.assign(dept, { name: body.name!.trim(), kind: body.kind!, parentId: body.parentId ?? null, headMemberId: body.headMemberId ?? null });
    const changes = [
      { field: 'Название', oldValue: before.name, newValue: dept.name },
      { field: 'Тип', oldValue: before.kind, newValue: dept.kind },
      { field: 'Родительский отдел', oldValue: before.parentId, newValue: dept.parentId },
      { field: 'Руководитель', oldValue: before.headMemberId, newValue: dept.headMemberId },
    ].filter((change) => change.oldValue !== change.newValue);
    if (changes.length) addAudit(store, ctx.org, ctx.user, request, 'DEPARTMENT_UPDATED', dept.name, changes);
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
    store.members.filter((m) => m.departmentId === dept.id).forEach((m) => bindDepartment(store, ctx, request, m, null));
    store.groups.filter((g) => g.departmentId === dept.id).forEach((g) => (g.departmentId = null));
    store.roles
      .filter((r) => r.departmentId === dept.id)
      .forEach((r) => {
        r.departmentId = null;
        if (r.scope === 'DEPARTMENT') r.scope = 'MEMBERS';
      });
    addAudit(store, ctx.org, ctx.user, request, 'DEPARTMENT_DELETED', dept.name, [
      { field: 'Название', oldValue: dept.name, newValue: null },
      { field: 'Тип', oldValue: dept.kind, newValue: null },
    ]);
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
      .forEach((m) => bindDepartment(store, ctx, request, m, dept.id));
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
        matrix: r.matrix,
        demoOptions: r.matrix.filter((k) => !allowed.includes(k)).length,
        scope: null,
        departmentId: null,
        memberIds: [],
        employeesCount: users.filter((u) => u.roles.some((x) => x.role === r.systemRole && x.clientSlug === ctx.org.clientSlug)).length,
      }));
    return HttpResponse.json({
      roles: [...systemRoles, ...store.roles.filter((r) => r.tenantId === ctx.org.tenantId).map((r) => toTenantRole(r, store, allowed))],
      catalog: pruneCatalog(matrixOf('ORGANIZATION_ADMIN')),
      demoModules: demoModulesOf(ctx.org),
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
    addAudit(store, ctx.org, ctx.user, request, 'ROLE_CREATED', role.name, [
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
    const before = { name: role.name, nameKz: role.nameKz, description: role.description, scope: role.scope, departmentId: role.departmentId };
    Object.assign(role, {
      name: body.nameRu!.trim(),
      nameKz: body.nameKz!.trim(),
      description: (body.description ?? '').trim(),
      scope: body.scope!,
      departmentId: body.scope === 'DEPARTMENT' ? body.departmentId! : null,
      matrix,
    });
    applyRoleMembers(store, role, ctx.org, body.memberIds ?? []);
    const changes = [
      { field: 'Название', oldValue: before.name, newValue: role.name },
      { field: 'Название на казахском', oldValue: before.nameKz, newValue: role.nameKz },
      { field: 'Описание', oldValue: before.description || null, newValue: role.description || null },
      { field: 'Область действия', oldValue: before.scope, newValue: role.scope },
      { field: 'Отдел', oldValue: before.departmentId, newValue: role.departmentId },
      { field: 'Выключены опции', oldValue: removed.join(', ') || null, newValue: null },
      { field: 'Включены опции', oldValue: null, newValue: added.join(', ') || null },
    ].filter((change) => change.oldValue !== change.newValue && (change.oldValue !== null || change.newValue !== null));
    if (changes.length)
      addAudit(store, ctx.org, ctx.user, request, removed.length || added.length ? 'ROLE_MATRIX_CHANGED' : 'ROLE_UPDATED', role.name, changes);
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
    addAudit(store, ctx.org, ctx.user, request, 'ROLE_DELETED', role.name, [
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
    const store = syncMembers(ctx.org);
    return HttpResponse.json(store.groups.filter((g) => g.tenantId === ctx.org.tenantId).map((g) => toGroup(g, ctx.org, ctx.user)));
  }),

  http.get('/api/tenant/groups/options', async ({ request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_groups.view');
    if (ctx instanceof Response) return ctx;
    const store = syncMembers(ctx.org);
    const users = loadUsers();
    const result: GroupFormOptions = {
      academicYears: academicYears(),
      departments: store.departments.filter((d) => d.tenantId === ctx.org.tenantId).map((d) => ({ id: d.id, name: d.name })),
      programs: listCourses(ctx.org).map((c) => ({ id: c.id, title: c.title, formatIds: c.formatIds, assessmentIds: c.assessmentIds })),
      trainers: store.trainers
        .filter((t) => t.tenantId === ctx.org.tenantId)
        .map((t) => {
          const u = users.find((x) => x.id === t.userId);
          return { id: t.id, fullName: u ? fullNameOf(u) : '', active: t.active };
        }),
      profileSchemes: canAttachScheme(ctx.user) ? schemesForTenant(ctx.org.tenantId).map((s) => ({ id: s.id, name: s.name })) : [],
      canAttachProfileScheme: canAttachScheme(ctx.user),
    };
    return HttpResponse.json(result);
  }),

  http.post('/api/tenant/groups', async ({ request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_groups.create');
    if (ctx instanceof Response) return ctx;
    const raw = (await request.json().catch(() => ({}))) as Partial<OrgGroupPayload>;
    const body = { ...raw, profileSchemeId: schemeFor(raw, ctx) };
    const store = syncMembers(ctx.org);
    const fe = validateGroup(body, ctx.org);
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);
    const taken = store.groups.some((g) => g.inviteHash === body.inviteHash);
    const hash = ctx.user.access.includes('lms_groups.invite_link') && HASH.test(body.inviteHash ?? '') && !taken ? body.inviteHash! : newInviteHash();
    const numbers = store.groups.filter((g) => g.tenantId === ctx.org.tenantId).map((g) => Number(/\d+/.exec(g.name)?.[0] ?? 0));
    const group: GroupRecord = {
      id: crypto.randomUUID(),
      tenantId: ctx.org.tenantId,
      name: `Группа ${Math.max(0, ...numbers) + 1}`,
      ...groupFields(body),
      inviteHash: hash,
      listenerIds: [],
      createdAt: new Date().toISOString(),
    };
    store.groups.push(group);
    addAudit(store, ctx.org, ctx.user, request, 'GROUP_CREATED', group.name, groupChanges(null, group, ctx.org));
    saveStructure(store);
    return HttpResponse.json(toGroup(group, ctx.org, ctx.user), { status: 201 });
  }),

  http.put('/api/tenant/groups/:id', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_groups.edit');
    if (ctx instanceof Response) return ctx;
    const store = syncMembers(ctx.org);
    const group = store.groups.find((g) => g.id === params.id && g.tenantId === ctx.org.tenantId);
    if (!group) return err(404, 'NOT_FOUND');
    const raw = (await request.json().catch(() => ({}))) as Partial<OrgGroupPayload>;
    const body = { ...raw, profileSchemeId: schemeFor(raw, ctx, group) };
    const fe = validateGroup(body, ctx.org, group);
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);
    const before = { ...group };
    Object.assign(group, groupFields(body));
    const nextHash = body.inviteHash;
    if (
      nextHash &&
      nextHash !== group.inviteHash &&
      ctx.user.access.includes('lms_groups.invite_link') &&
      HASH.test(nextHash) &&
      !store.groups.some((g) => g.inviteHash === nextHash)
    )
      group.inviteHash = nextHash;
    const changes = groupChanges(before, group, ctx.org);
    if (changes.length) addAudit(store, ctx.org, ctx.user, request, 'GROUP_UPDATED', group.name, changes);
    saveStructure(store);
    return HttpResponse.json(toGroup(group, ctx.org, ctx.user));
  }),

  http.delete('/api/tenant/groups/:id', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_groups.delete');
    if (ctx instanceof Response) return ctx;
    const store = loadStructure();
    const removed = store.groups.find((g) => g.id === params.id && g.tenantId === ctx.org.tenantId);
    if (!removed) return err(404, 'NOT_FOUND');
    addAudit(store, ctx.org, ctx.user, request, 'GROUP_DELETED', removed.name, [{ field: 'Группа', oldValue: removed.name, newValue: null }]);
    store.groups = store.groups.filter((g) => g.id !== params.id);
    store.applications = store.applications.filter((application) => application.groupId !== params.id);
    saveStructure(store);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('/api/tenant/groups/:id/listeners', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_groups.listeners_view');
    if (ctx instanceof Response) return ctx;
    const store = syncMembers(ctx.org, true);
    const group = store.groups.find((g) => g.id === params.id && g.tenantId === ctx.org.tenantId);
    if (!group) return err(404, 'NOT_FOUND');
    const users = loadUsers();
    return HttpResponse.json(store.members.filter((m) => group.listenerIds.includes(m.id)).map((m) => toListener(m, users)));
  }),

  // Быстрое зачисление: поиск по ИИН, ФИО или Email среди пользователей организации
  http.get('/api/tenant/groups/:id/candidates', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_groups.add_members_manual');
    if (ctx instanceof Response) return ctx;
    const store = syncMembers(ctx.org, true);
    const group = store.groups.find((g) => g.id === params.id && g.tenantId === ctx.org.tenantId);
    if (!group) return err(404, 'NOT_FOUND');
    const q = (new URL(request.url).searchParams.get('q') ?? '').trim().toLowerCase();
    if (q.length < 3) return HttpResponse.json([]);
    const users = loadUsers();
    return HttpResponse.json(
      store.members
        .filter((m) => m.tenantId === ctx.org.tenantId && m.active && !group.listenerIds.includes(m.id))
        .map((m) => toListener(m, users))
        .filter((l) => [l.fullName, l.iin, l.email].some((v) => v.toLowerCase().includes(q)))
        .slice(0, 20),
    );
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
    const next = [...new Set([...group.listenerIds, ...valid])];
    if (next.length > group.listenersLimit)
      return err(400, 'VALIDATION_ERROR', `В группе лимит ${group.listenersLimit} слушателей. Увеличьте его в настройках группы.`);
    const added = valid.filter((id) => !group.listenerIds.includes(id));
    group.listenerIds = next;
    if (added.length)
      addAudit(store, ctx.org, ctx.user, request, 'GROUP_LISTENERS_ADDED', group.name, [
        { field: 'Слушатели', oldValue: null, newValue: added.map((id) => store.members.find((m) => m.id === id)?.fullName ?? id).join(', ') },
      ]);
    saveStructure(store);
    return HttpResponse.json(toGroup(group, ctx.org, ctx.user));
  }),

  http.delete('/api/tenant/groups/:id/listeners/:memberId', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_groups.add_members_manual');
    if (ctx instanceof Response) return ctx;
    const store = loadStructure();
    const group = store.groups.find((g) => g.id === params.id && g.tenantId === ctx.org.tenantId);
    if (!group) return err(404, 'NOT_FOUND');
    if (group.listenerIds.includes(String(params.memberId)))
      addAudit(store, ctx.org, ctx.user, request, 'GROUP_LISTENER_REMOVED', group.name, [
        { field: 'Слушатель', oldValue: store.members.find((m) => m.id === params.memberId)?.fullName ?? String(params.memberId), newValue: null },
      ]);
    group.listenerIds = group.listenerIds.filter((id) => id !== params.memberId);
    saveStructure(store);
    return HttpResponse.json(toGroup(group, ctx.org, ctx.user));
  }),

  http.get('/api/tenant/groups/:id/applications', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_showcase_applications.view');
    if (ctx instanceof Response) return ctx;
    const store = loadStructure();
    if (!store.groups.some((group) => group.id === params.id && group.tenantId === ctx.org.tenantId)) return err(404, 'NOT_FOUND');
    return HttpResponse.json(
      store.applications
        .filter((application) => application.groupId === params.id && application.tenantId === ctx.org.tenantId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }),

  http.post('/api/tenant/groups/:id/applications/:applicationId/confirm', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_showcase_applications.confirm');
    if (ctx instanceof Response) return ctx;
    const store = loadStructure();
    const group = store.groups.find((item) => item.id === params.id && item.tenantId === ctx.org.tenantId);
    const application = store.applications.find((item) => item.id === params.applicationId && item.groupId === params.id);
    if (!group || !application) return err(404, 'NOT_FOUND');
    if (application.status !== 'NEW') return err(400, 'VALIDATION_ERROR', 'Заявка уже обработана.');
    if (group.listenerIds.length >= group.listenersLimit) return err(400, 'VALIDATION_ERROR', 'В группе нет свободных мест.');
    const users = loadUsers();
    // Поиск только по Email: совпадение ФИО у однофамильцев зачислило бы в группу чужую учётную запись
    let user = users.find((item) => item.email.toLowerCase() === application.email.toLowerCase());
    if (!user) {
      const [lastName = '', firstName = '', ...middle] = application.fullName.split(/\s+/);
      user = {
        id: crypto.randomUUID(),
        iin: nextIin(new Set(users.map((item) => item.iin))),
        lastName,
        firstName,
        middleName: middle.join(' ') || undefined,
        region: '',
        phone: application.phone,
        email: application.email,
        passwordHash: hashPassword('Sanastra1'),
        roles: [{ role: 'LEARNER', clientSlug: ctx.org.clientSlug }],
        failedAttempts: 0,
        profileCompleted: false,
      };
      users.push(user);
      saveUsers(users);
    }
    if (!addUserToGroup(ctx.org, group, user)) return err(400, 'VALIDATION_ERROR', 'В группе нет свободных мест.');
    const updatedStore = loadStructure();
    const updatedApplication = updatedStore.applications.find((item) => item.id === application.id)!;
    updatedApplication.status = 'CONFIRMED';
    addAudit(updatedStore, ctx.org, ctx.user, request, 'APPLICATION_CONFIRMED', group.name, [
      { field: 'Заявитель', oldValue: null, newValue: `${application.fullName}, ${application.email}` },
      { field: 'Статус заявки', oldValue: 'Новая', newValue: 'Подтверждена' },
    ]);
    saveStructure(updatedStore);
    return HttpResponse.json(updatedApplication);
  }),

  http.post('/api/tenant/groups/:id/applications/:applicationId/reject', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_showcase_applications.reject');
    if (ctx instanceof Response) return ctx;
    const store = loadStructure();
    const application = store.applications.find(
      (item) => item.id === params.applicationId && item.groupId === params.id && item.tenantId === ctx.org.tenantId,
    );
    if (!application) return err(404, 'NOT_FOUND');
    if (application.status !== 'NEW') return err(400, 'VALIDATION_ERROR', 'Заявка уже обработана.');
    application.status = 'REJECTED';
    addAudit(store, ctx.org, ctx.user, request, 'APPLICATION_REJECTED', store.groups.find((g) => g.id === application.groupId)?.name ?? '', [
      { field: 'Заявитель', oldValue: null, newValue: `${application.fullName}, ${application.email}` },
      { field: 'Статус заявки', oldValue: 'Новая', newValue: 'Отклонена' },
    ]);
    saveStructure(store);
    return HttpResponse.json(application);
  }),

  // ---------- Конструктор отчётов ----------
  http.get('/api/tenant/reports/:type', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_report_builder.builder_basic');
    if (ctx instanceof Response) return ctx;
    const type = String(params.type) as ReportType;
    if (!(type in REPORT_TITLE)) return err(400, 'VALIDATION_ERROR', 'Неизвестный тип отчёта.');
    const url = new URL(request.url);
    const positionId = url.searchParams.get('positionId');
    // Фильтр принимает только значения, видимые организации
    if (positionId && !isVisibleItem(positionId, 'position', ctx.org.tenantId)) return err(400, 'VALIDATION_ERROR', 'Значение справочника недоступно.');
    return HttpResponse.json(buildReport(type, ctx.org, { groupId: url.searchParams.get('groupId'), courseId: url.searchParams.get('courseId'), positionId }));
  }),

  // ---------- Учебные программы: изменение и удаление ----------
  http.post('/api/tenant/programs', async ({ request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_prog_core.create');
    if (ctx instanceof Response) return ctx;
    if ((ctx.org.usage.COURSES_COUNT ?? 0) >= effectiveLimitValues(ctx.org).COURSES_COUNT!) return err(403, 'LIMIT_REACHED');
    const body = (await request.json().catch(() => ({}))) as Partial<ProgramPayload>;
    const { fe, fields } = validateProgram(body, ctx.org);
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);
    const course = addCourse(ctx.org, { ...fields, teacher: ctx.user.fullName });
    const db = load();
    const org = db.organizations.find((o) => o.tenantId === ctx.org.tenantId)!;
    org.usage.COURSES_COUNT = courseCount(ctx.org);
    save(db);
    publish({ type: 'limits.updated', tenantId: org.tenantId, version: org.version, changed: ['limits'], occurredAt: new Date().toISOString() });
    auditOnly(ctx, request, 'PROGRAM_CREATED', course.titleRu || course.title, [{ field: 'Программа', oldValue: null, newValue: course.titleRu || course.title }]);
    return HttpResponse.json(course, { status: 201 });
  }),

  http.put('/api/tenant/programs/:id', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_prog_core.edit');
    if (ctx instanceof Response) return ctx;
    const body = (await request.json().catch(() => ({}))) as Partial<ProgramPayload>;
    const { fe, fields } = validateProgram(body, ctx.org);
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);
    const previous = findCourse(ctx.org, String(params.id));
    const course = updateCourse(ctx.org, String(params.id), fields);
    if (!course) return err(404, 'NOT_FOUND');
    const changes = [
      { field: 'Название', oldValue: previous ? previous.titleRu || previous.title : null, newValue: course.titleRu || course.title },
      { field: 'Статус', oldValue: previous?.status ?? null, newValue: course.status },
      { field: 'Часы (теория + практика)', oldValue: previous ? `${previous.hoursTheory ?? 0} + ${previous.hoursPractice ?? 0}` : null, newValue: `${course.hoursTheory ?? 0} + ${course.hoursPractice ?? 0}` },
    ].filter((c) => c.oldValue !== c.newValue);
    auditOnly(ctx, request, 'PROGRAM_UPDATED', course.titleRu || course.title, changes.length ? changes : [{ field: 'Описание программы', oldValue: null, newValue: 'изменено' }]);
    return HttpResponse.json(course);
  }),

  http.delete('/api/tenant/courses/:id', async ({ params, request }) => {
    await latency();
    const ctx = sectionContext(request, 'lms_prog_core.delete');
    if (ctx instanceof Response) return ctx;
    const removedCourse = findCourse(ctx.org, String(params.id));
    if (!removeCourse(ctx.org, String(params.id))) return err(404, 'NOT_FOUND');
    removeCourseContent(String(params.id));
    const store = loadStructure();
    const title = removedCourse ? removedCourse.titleRu || removedCourse.title : String(params.id);
    addAudit(store, ctx.org, ctx.user, request, 'PROGRAM_DELETED', title, [{ field: 'Программа', oldValue: title, newValue: null }]);
    store.groups.filter((g) => g.courseId === params.id).forEach((g) => (g.courseId = null));
    saveStructure(store);
    const db = load();
    const org = db.organizations.find((o) => o.tenantId === ctx.org.tenantId)!;
    org.usage.COURSES_COUNT = courseCount(ctx.org);
    save(db);
    return new HttpResponse(null, { status: 204 });
  }),
];

function toTrainer(t: TrainerEntry, users: UserRecord[]): OrgTrainer {
  const u = users.find((x) => x.id === t.userId);
  return {
    id: t.id,
    fullName: u ? fullNameOf(u) : '',
    iin: u?.iin ?? '',
    email: u?.email ?? '',
    phone: u?.phone ?? '',
    active: t.active,
    assignedAt: t.assignedAt,
    categoryId: t.categoryId ?? null,
    categoryName: itemName(t.categoryId),
  };
}

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

