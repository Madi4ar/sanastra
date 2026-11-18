/**
 * API кабинетов слушателя и тренера, анкет и конструктора динамических полей профиля (ТЗ 15, 16).
 * Права и состояние курса проверяются здесь, на сервере: интерфейс только отображает результат.
 */
import dayjs from 'dayjs';
import { http, HttpResponse } from 'msw';
import type {
  AttendanceSheet,
  AuditChange,
  AuditEvent,
  CourseAbout,
  CourseElement,
  CourseModule,
  CurrentUser,
  GlobalProfileField,
  GlobalProfileFieldPayload,
  LearnerCourseCard,
  LearnerCourseState,
  LearnerCourseView,
  ProfileFieldBuilderData,
  ProfileFieldOption,
  ProfileFieldPayload,
  ProfileFieldSchemePayload,
  ProfileForm,
  ProfileFormSection,
  ProgressMatrix,
  TestAnswers,
  TestResult,
  TrainerCourseCard,
  TrainerCourseView,
} from '@/api/types';
import type { TestSettings } from '@/features/course-builder/elementTypes';
import { richTextToPlain } from '@/shared/richText';
import { findCourse } from './content';
import { getStructure } from './courseBuilder';
import type { OrgRecord } from './db';
import { itemName } from './directories';
import { err, latency, requireRole, subscriptionGuard, tenantContext } from './handlers';
import { addAudit, loadStructure, saveStructure, syncMembers, type GroupRecord } from './orgStructure';
import {
  directoryItems,
  elementProgress,
  ensureDefaultScheme,
  fieldsForTenant,
  findField,
  findProgress,
  formFields,
  gradeTest,
  isAccountField,
  isGlobalActiveForTenant,
  kindOf,
  loadProfileFields,
  missingCount,
  percentOf,
  progressFor,
  saveProfileFields,
  schemesForTenant,
  toDefinition,
  toScheme,
  trainerRows,
  valueKey,
  withoutAnswers,
  type AccountData,
  type FieldRecord,
} from './profileFields';
import { fullNameOf, loadUsers, type UserRecord } from './users';

type Ctx = { org: OrgRecord; user: CurrentUser };

/** Архив: через 14 календарных дней после даты окончания группы */
const isArchive = (endDate: string) => dayjs().startOf('day').isAfter(dayjs(endDate).add(14, 'day'));
const isBeforeStart = (startDate: string) => dayjs().isBefore(dayjs(startDate), 'day');

function roleContext(request: Request, role: 'LEARNER' | 'TRAINER'): Ctx | Response {
  const ctx = tenantContext(request);
  if (ctx instanceof Response) return ctx;
  const blocked = subscriptionGuard(ctx.org);
  if (blocked) return blocked;
  if (ctx.user.role !== role) return err(403, 'FORBIDDEN');
  return ctx;
}

/** Раздел конструктора полей: опция модуля в итоговом доступе (матрица роли ∩ тариф) */
function builderContext(request: Request, ...options: string[]): Ctx | Response {
  const ctx = tenantContext(request);
  if (ctx instanceof Response) return ctx;
  const blocked = subscriptionGuard(ctx.org);
  if (blocked) return blocked;
  const allowed = options.some((option) => ctx.user.access.includes(`lms_profile_field_builder.${option}`));
  if (ctx.user.role === 'SUPERADMIN' || !allowed) return err(403, 'FORBIDDEN');
  return ctx;
}

const accountOf = (user: UserRecord | undefined): AccountData => ({
  iin: user?.iin ?? '',
  fullName: user ? fullNameOf(user) : '',
  email: user?.email ?? '',
  phone: user?.phone ?? '',
  region: user?.region ?? '',
});

const visibleElements = (modules: CourseModule[]) => modules.flatMap((m) => m.days.flatMap((d) => d.elements));

/** Структура курса так, как её видит слушатель: без скрытых элементов и без верных ответов */
const learnerModules = (courseId: string): CourseModule[] =>
  getStructure(courseId).map((m) => ({
    ...m,
    days: m.days.map((d) => ({ ...d, elements: d.elements.filter((e) => !e.hidden).map(withoutAnswers) })),
  }));

/** Полная структура (с ответами) — только для проверки на сервере */
const sourceElement = (courseId: string, elementId: string): CourseElement | undefined =>
  getStructure(courseId)
    .flatMap((m) => m.days.flatMap((d) => d.elements))
    .find((e) => e.id === elementId && !e.hidden);

function aboutOf(org: OrgRecord, courseId: string): CourseAbout | null {
  const course = findCourse(org, courseId);
  if (!course) return null;
  return {
    id: course.id,
    title: course.titleRu || course.title,
    coverUrl: course.coverUrl,
    description: richTextToPlain(course.descriptionRu),
    goal: richTextToPlain(course.goalRu),
    result: richTextToPlain(course.resultRu),
  };
}

// ---------- Слушатель ----------

function learnerGroups(ctx: Ctx) {
  const store = syncMembers(ctx.org);
  const member = store.members.find((m) => m.tenantId === ctx.org.tenantId && m.userId === ctx.user.id);
  const groups = member
    ? store.groups.filter((g) => g.tenantId === ctx.org.tenantId && g.listenerIds.includes(member.id) && g.courseId && findCourse(ctx.org, g.courseId))
    : [];
  return { store, member, groups };
}

const schemeRows = (group: GroupRecord) => {
  const schemes = schemesForTenant(group.tenantId);
  return (schemes.find((s) => s.id === group.profileSchemeId) ?? ensureDefaultScheme(group.tenantId)).fields;
};

function learnerSection(ctx: Ctx, group: GroupRecord, account: AccountData): ProfileFormSection {
  const fields = formFields(loadProfileFields(), ctx.org.tenantId, ctx.user.id, account, schemeRows(group));
  const course = group.courseId ? findCourse(ctx.org, group.courseId) : undefined;
  return { id: group.id, title: course ? `${group.name} · ${course.titleRu || course.title}` : group.name, fields, missing: missingCount(fields) };
}

function trainerSection(ctx: Ctx, account: AccountData): ProfileFormSection {
  const fields = formFields(loadProfileFields(), ctx.org.tenantId, ctx.user.id, account, trainerRows(loadProfileFields(), ctx.org.tenantId));
  return { id: 'trainer', title: 'Анкета тренера', fields, missing: missingCount(fields) };
}

function profileForm(ctx: Ctx): ProfileForm {
  const account = accountOf(loadUsers().find((u) => u.id === ctx.user.id));
  const sections = ctx.user.role === 'TRAINER' ? [trainerSection(ctx, account)] : learnerGroups(ctx).groups.map((g) => learnerSection(ctx, g, account));
  return { sections, missing: sections.reduce((sum, s) => sum + s.missing, 0) };
}

function stateOf(group: GroupRecord, percent: number): LearnerCourseState {
  if (isArchive(group.endDate)) return 'ARCHIVE';
  if (isBeforeStart(group.startDate)) return 'NOT_STARTED';
  return percent > 0 ? 'IN_PROGRESS' : 'NEW';
}

const trainerNamesOf = (group: GroupRecord, store: ReturnType<typeof loadStructure>, users: UserRecord[]) =>
  group.trainerIds.flatMap((id) => {
    const trainer = store.trainers.find((t) => t.id === id);
    const user = trainer && users.find((u) => u.id === trainer.userId);
    return user ? [fullNameOf(user)] : [];
  });

/** Доступ слушателя к прохождению группы: зачислен, курс начался, анкета заполнена */
function learnerGroup(ctx: Ctx, groupId: string, forWork = false): { group: GroupRecord; courseId: string } | Response {
  const { groups } = learnerGroups(ctx);
  const group = groups.find((g) => g.id === groupId);
  if (!group?.courseId) return err(404, 'NOT_FOUND');
  if (isBeforeStart(group.startDate)) return err(403, 'COURSE_NOT_STARTED', `Курс еще не начался. Пожалуйста, ожидайте даты начала ${dayjs(group.startDate).format('DD.MM.YYYY')}`);
  const archive = isArchive(group.endDate);
  if (!archive) {
    const section = learnerSection(ctx, group, accountOf(loadUsers().find((u) => u.id === ctx.user.id)));
    if (section.missing) return err(403, 'PROFILE_INCOMPLETE', `Заполните еще ${section.missing} полей анкеты для доступа к обучению.`);
  }
  if (forWork && archive) return err(403, 'COURSE_ARCHIVED', 'Курс в архиве: доступен только обзор материалов.');
  return { group, courseId: group.courseId };
}

function learnerView(ctx: Ctx, group: GroupRecord): LearnerCourseView {
  const modules = learnerModules(group.courseId!);
  const elements = visibleElements(modules);
  const record = findProgress(group.id, ctx.user.id);
  return {
    groupId: group.id,
    groupName: group.name,
    course: aboutOf(ctx.org, group.courseId!)!,
    startDate: group.startDate,
    endDate: group.endDate,
    readonly: isArchive(group.endDate),
    percent: percentOf(elements, record),
    modules,
    progress: Object.fromEntries(elements.map((e) => [e.id, elementProgress(e, record?.elements[e.id])])),
  };
}

// ---------- Тренер ----------

function trainerGroups(ctx: Ctx) {
  const store = syncMembers(ctx.org);
  const trainer = store.trainers.find((t) => t.tenantId === ctx.org.tenantId && t.userId === ctx.user.id && t.active);
  const groups = trainer
    ? store.groups.filter((g) => g.tenantId === ctx.org.tenantId && g.trainerIds.includes(trainer.id) && g.courseId && findCourse(ctx.org, g.courseId))
    : [];
  return { store, groups };
}

function trainerGroup(ctx: Ctx, groupId: string) {
  const { store, groups } = trainerGroups(ctx);
  const group = groups.find((g) => g.id === groupId);
  return group ? { store, group, groups } : null;
}

const listenersOf = (group: GroupRecord, store: ReturnType<typeof loadStructure>) =>
  group.listenerIds.flatMap((id) => {
    const member = store.members.find((m) => m.id === id);
    return member ? [member] : [];
  });

// ---------- Конструктор полей ----------

const LABELS: (keyof Pick<ProfileFieldPayload, 'labelKz' | 'labelRu' | 'labelEn'>)[] = ['labelKz', 'labelRu', 'labelEn'];

function validateField(body: Partial<ProfileFieldPayload>, canDropdown: boolean): Record<string, string> {
  const fe: Record<string, string> = {};
  for (const key of LABELS) if (!String(body[key] ?? '').trim()) fe[key] = 'Укажите название';
  if (body.type !== 'TEXT' && body.type !== 'DROPDOWN') fe.type = 'Выберите тип поля';
  if (body.type === 'DROPDOWN') {
    if (!canDropdown) fe.type = 'Справочники полей недоступны вашей роли';
    const options = body.options ?? [];
    if (!options.length) fe.options = 'Добавьте хотя бы одно значение справочника';
    else if (options.some((o) => LABELS.some((key) => !String(o?.[key] ?? '').trim()))) fe.options = 'Заполните значения на трёх языках';
  }
  return fe;
}

const cleanOptions = (options: ProfileFieldOption[] | undefined): ProfileFieldOption[] =>
  (options ?? []).map((o) => ({
    id: typeof o.id === 'string' && o.id ? o.id : crypto.randomUUID(),
    labelKz: o.labelKz.trim(),
    labelRu: o.labelRu.trim(),
    labelEn: o.labelEn.trim(),
  }));

/** Значения DROPDOWN хранятся в отдельном справочнике организации (или глобальном — для полей суперадмина) */
function upsertDirectory(store: ReturnType<typeof loadProfileFields>, field: FieldRecord, body: Partial<ProfileFieldPayload>) {
  if (body.type !== 'DROPDOWN') {
    if (field.directoryId) store.directories = store.directories.filter((d) => d.id !== field.directoryId);
    field.directoryId = null;
    return;
  }
  const items = cleanOptions(body.options);
  const existing = store.directories.find((d) => d.id === field.directoryId);
  if (existing) existing.items = items;
  else {
    const directory = { id: crypto.randomUUID(), tenantId: field.tenantId, items };
    store.directories.push(directory);
    field.directoryId = directory.id;
  }
}

function validateScheme(tenantId: string, body: Partial<ProfileFieldSchemePayload>): Record<string, string> {
  const fe: Record<string, string> = {};
  if (!String(body.name ?? '').trim()) fe.name = 'Укажите название схемы';
  const rows = body.fields ?? [];
  if (!rows.length) fe.fields = 'Выберите поля схемы';
  const available = new Set(fieldsForTenant(tenantId).map((f) => f.id));
  if (rows.some((r) => !available.has(r.fieldId))) fe.fields = 'Поле недоступно организации';
  if (new Set(rows.map((r) => r.fieldId)).size !== rows.length) fe.fields = 'Поле выбрано несколько раз';
  return fe;
}

function builderData(tenantId: string): ProfileFieldBuilderData {
  const store = loadProfileFields();
  const groups = loadStructure().groups.filter((g) => g.tenantId === tenantId);
  const defaultId = ensureDefaultScheme(tenantId).id;
  return {
    globals: store.globals.filter((f) => f.active).map((f) => ({ ...toDefinition(store, f), activeForTenant: isGlobalActiveForTenant(store, tenantId, f) })),
    custom: store.custom.filter((f) => f.tenantId === tenantId).map((f) => toDefinition(store, f)),
    schemes: schemesForTenant(tenantId).map((s) =>
      toScheme(s, groups.filter((g) => (g.profileSchemeId ?? defaultId) === s.id).length),
    ),
    trainerSchemeId: store.trainerSchemeByTenant[tenantId] ?? null,
  };
}

function audit(ctx: Ctx, request: Request, event: AuditEvent, target: string, changes: AuditChange[]) {
  const store = loadStructure();
  addAudit(store, ctx.org, ctx.user, request, event, target, changes);
  saveStructure(store);
}

const fieldLabel = (store: ReturnType<typeof loadProfileFields>, tenantId: string, id: string) => findField(store, tenantId, id)?.labelRu ?? id;
const rowsText = (store: ReturnType<typeof loadProfileFields>, tenantId: string, rows: { fieldId: string; required: boolean }[]) =>
  rows.map((r) => `${fieldLabel(store, tenantId, r.fieldId)}${r.required ? ' (обяз.)' : ''}`).join(', ') || null;

const toGlobal = (store: ReturnType<typeof loadProfileFields>, f: FieldRecord): GlobalProfileField => ({
  ...toDefinition(store, f),
  inTrainerProfile: Boolean(f.inTrainerProfile),
  trainerRequired: Boolean(f.trainerRequired),
  accountField: Boolean(f.source),
});

export const cabinetHandlers = () => [
  // ---------- Слушатель: мои курсы ----------
  http.get('/api/tenant/learner/courses', async ({ request }) => {
    await latency();
    const ctx = roleContext(request, 'LEARNER');
    if (ctx instanceof Response) return ctx;
    const { store, groups } = learnerGroups(ctx);
    const users = loadUsers();
    const account = accountOf(users.find((u) => u.id === ctx.user.id));
    const result: LearnerCourseCard[] = groups.map((group) => {
      const course = findCourse(ctx.org, group.courseId!)!;
      const percent = percentOf(visibleElements(learnerModules(course.id)), findProgress(group.id, ctx.user.id));
      return {
        groupId: group.id,
        groupName: group.name,
        courseId: course.id,
        courseTitle: course.titleRu || course.title,
        coverUrl: course.coverUrl,
        startDate: group.startDate,
        endDate: group.endDate,
        trainerNames: trainerNamesOf(group, store, users),
        formatName: itemName(group.formatId) ?? null,
        percent,
        state: stateOf(group, percent),
        missingProfileFields: learnerSection(ctx, group, account).missing,
      };
    });
    return HttpResponse.json(result.sort((a, b) => b.startDate.localeCompare(a.startDate)));
  }),

  http.get('/api/tenant/learner/courses/:groupId', async ({ params, request }) => {
    await latency();
    const ctx = roleContext(request, 'LEARNER');
    if (ctx instanceof Response) return ctx;
    const access = learnerGroup(ctx, String(params.groupId));
    if (access instanceof Response) return access;
    return HttpResponse.json(learnerView(ctx, access.group));
  }),

  http.post('/api/tenant/learner/courses/:groupId/elements/:elementId/view', async ({ params, request }) => {
    await latency();
    const ctx = roleContext(request, 'LEARNER');
    if (ctx instanceof Response) return ctx;
    const access = learnerGroup(ctx, String(params.groupId));
    if (access instanceof Response) return access;
    const element = sourceElement(access.courseId, String(params.elementId));
    if (!element) return err(404, 'NOT_FOUND');
    // Архив — только обзор: прогресс не меняется
    if (!isArchive(access.group.endDate)) {
      const store = loadProfileFields();
      const state = (progressFor(access.group.id, ctx.user.id, store).elements[element.id] ??= {});
      if (kindOf(element) === 'view') state.viewed = true;
      if (kindOf(element) === 'test' && !state.test) state.testStarted = true;
      saveProfileFields(store);
    }
    return HttpResponse.json(learnerView(ctx, access.group));
  }),

  http.post('/api/tenant/learner/courses/:groupId/elements/:elementId/test', async ({ params, request }) => {
    await latency();
    const ctx = roleContext(request, 'LEARNER');
    if (ctx instanceof Response) return ctx;
    const access = learnerGroup(ctx, String(params.groupId), true);
    if (access instanceof Response) return access;
    const element = sourceElement(access.courseId, String(params.elementId));
    if (!element || element.type !== 'test') return err(404, 'NOT_FOUND');
    const body = (await request.json().catch(() => ({}))) as { answers?: TestAnswers };
    const store = loadProfileFields();
    const state = (progressFor(access.group.id, ctx.user.id, store).elements[element.id] ??= {});
    if (state.test?.passed) return err(400, 'VALIDATION_ERROR', 'Тест уже сдан.');
    const attempts = (element.settings as unknown as TestSettings).attempts;
    if (attempts !== null && attempts !== undefined && (state.testAttempts ?? 0) >= attempts) return err(400, 'VALIDATION_ERROR', 'Попытки закончились.');
    const graded = gradeTest(element, body.answers ?? {});
    state.testAttempts = (state.testAttempts ?? 0) + 1;
    state.test = { score: graded.score, maxScore: graded.maxScore, percent: graded.percent, passed: graded.passed };
    saveProfileFields(store);
    const result: TestResult = { ...graded, dryRun: false };
    return HttpResponse.json(result);
  }),

  http.post('/api/tenant/learner/courses/:groupId/elements/:elementId/work', async ({ params, request }) => {
    await latency();
    const ctx = roleContext(request, 'LEARNER');
    if (ctx instanceof Response) return ctx;
    const access = learnerGroup(ctx, String(params.groupId), true);
    if (access instanceof Response) return access;
    const element = sourceElement(access.courseId, String(params.elementId));
    if (!element || kindOf(element) !== 'work') return err(404, 'NOT_FOUND');
    const body = (await request.json().catch(() => ({}))) as { answer?: string };
    const answer = String(body.answer ?? '').trim();
    if (!answer) return err(400, 'VALIDATION_ERROR', 'Введите ответ.', { answer: 'Введите ответ' });
    const store = loadProfileFields();
    const state = (progressFor(access.group.id, ctx.user.id, store).elements[element.id] ??= {});
    if (state.work?.done) return err(400, 'VALIDATION_ERROR', 'Работа уже принята тренером.');
    state.work = { answer, done: false, score: null };
    saveProfileFields(store);
    return HttpResponse.json(learnerView(ctx, access.group));
  }),

  // ---------- Анкета пользователя (слушатель и тренер) ----------
  http.get('/api/tenant/profile-form', async ({ request }) => {
    await latency();
    const ctx = tenantContext(request);
    if (ctx instanceof Response) return ctx;
    if (ctx.user.role !== 'LEARNER' && ctx.user.role !== 'TRAINER') return err(403, 'FORBIDDEN');
    return HttpResponse.json(profileForm(ctx));
  }),

  http.put('/api/tenant/profile-form', async ({ request }) => {
    await latency();
    const ctx = tenantContext(request);
    if (ctx instanceof Response) return ctx;
    if (ctx.user.role !== 'LEARNER' && ctx.user.role !== 'TRAINER') return err(403, 'FORBIDDEN');
    const body = (await request.json().catch(() => ({}))) as { values?: Record<string, unknown> };
    const form = profileForm(ctx);
    const fields = new Map(form.sections.flatMap((s) => s.fields).map((f) => [f.id, f]));
    const store = loadProfileFields();
    const key = valueKey(ctx.org.tenantId, ctx.user.id);
    const next = { ...(store.values[key] ?? {}) };
    const fe: Record<string, string> = {};
    for (const [fieldId, raw] of Object.entries(body.values ?? {})) {
      const field = fields.get(fieldId);
      if (!field || isAccountField(store, fieldId)) continue;
      const value = String(raw ?? '').trim();
      if (field.type === 'DROPDOWN' && value && !field.options.some((o) => o.id === value)) fe[fieldId] = 'Выберите значение из справочника';
      else if (value.length > 500) fe[fieldId] = 'Не более 500 символов';
      else if (value) next[fieldId] = value;
      else delete next[fieldId];
    }
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте заполнение анкеты.', fe);
    store.values[key] = next;
    saveProfileFields(store);
    return HttpResponse.json(profileForm(ctx));
  }),

  // ---------- Тренер: мои курсы ----------
  http.get('/api/tenant/trainer/courses', async ({ request }) => {
    await latency();
    const ctx = roleContext(request, 'TRAINER');
    if (ctx instanceof Response) return ctx;
    const result: TrainerCourseCard[] = trainerGroups(ctx).groups.map((group) => {
      const course = findCourse(ctx.org, group.courseId!)!;
      return {
        groupId: group.id,
        groupCode: group.name,
        courseId: course.id,
        courseTitle: course.titleRu || course.title,
        coverUrl: course.coverUrl,
        formatName: itemName(group.formatId) ?? null,
        listenersCount: group.listenerIds.length,
        startDate: group.startDate,
        endDate: group.endDate,
        academicYear: group.academicYear,
      };
    });
    return HttpResponse.json(result.sort((a, b) => b.startDate.localeCompare(a.startDate)));
  }),

  http.get('/api/tenant/trainer/courses/:groupId', async ({ params, request }) => {
    await latency();
    const ctx = roleContext(request, 'TRAINER');
    if (ctx instanceof Response) return ctx;
    const found = trainerGroup(ctx, String(params.groupId));
    if (!found) return err(404, 'NOT_FOUND');
    const { group, groups } = found;
    const result: TrainerCourseView = {
      groupId: group.id,
      course: aboutOf(ctx.org, group.courseId!)!,
      modules: learnerModules(group.courseId!),
      groups: groups
        .filter((g) => g.courseId === group.courseId)
        .sort((a, b) => b.startDate.localeCompare(a.startDate))
        .map((g) => ({ id: g.id, code: g.name, startDate: g.startDate })),
    };
    return HttpResponse.json(result);
  }),

  // Песочница тренера (Dry-Run): тест проверяется, но в прогресс и аналитику ничего не пишется
  http.post('/api/tenant/trainer/courses/:groupId/elements/:elementId/test', async ({ params, request }) => {
    await latency();
    const ctx = roleContext(request, 'TRAINER');
    if (ctx instanceof Response) return ctx;
    const found = trainerGroup(ctx, String(params.groupId));
    const element = found && sourceElement(found.group.courseId!, String(params.elementId));
    if (!element || element.type !== 'test') return err(404, 'NOT_FOUND');
    const body = (await request.json().catch(() => ({}))) as { answers?: TestAnswers };
    const result: TestResult = { ...gradeTest(element, body.answers ?? {}), dryRun: true };
    return HttpResponse.json(result);
  }),

  http.get('/api/tenant/trainer/groups/:groupId/attendance', async ({ params, request }) => {
    await latency();
    const ctx = roleContext(request, 'TRAINER');
    if (ctx instanceof Response) return ctx;
    const found = trainerGroup(ctx, String(params.groupId));
    if (!found) return err(404, 'NOT_FOUND');
    const { group, store } = found;
    const days = getStructure(group.courseId!).flatMap((m) => m.days);
    const marks = loadProfileFields().attendance;
    const result: AttendanceSheet = {
      groupId: group.id,
      days: days.map((d) => ({ id: d.id, title: d.title })),
      rows: listenersOf(group, store).map((m) => ({
        memberId: m.id,
        fullName: m.fullName,
        marks: Object.fromEntries(days.map((d) => [d.id, Boolean(marks[`${group.id}:${d.id}:${m.id}`])])),
      })),
    };
    return HttpResponse.json(result);
  }),

  http.put('/api/tenant/trainer/groups/:groupId/attendance', async ({ params, request }) => {
    await latency();
    const ctx = roleContext(request, 'TRAINER');
    if (ctx instanceof Response) return ctx;
    const found = trainerGroup(ctx, String(params.groupId));
    if (!found) return err(404, 'NOT_FOUND');
    const body = (await request.json().catch(() => ({}))) as { memberId?: string; dayId?: string; present?: boolean };
    const { group } = found;
    const day = getStructure(group.courseId!).flatMap((m) => m.days).find((d) => d.id === body.dayId);
    if (!day || !body.memberId || !group.listenerIds.includes(body.memberId)) return err(400, 'VALIDATION_ERROR', 'Слушатель или учебный день не найден.');
    const store = loadProfileFields();
    const key = `${group.id}:${day.id}:${body.memberId}`;
    if (body.present) store.attendance[key] = true;
    else delete store.attendance[key];
    saveProfileFields(store);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('/api/tenant/trainer/groups/:groupId/progress', async ({ params, request }) => {
    await latency();
    const ctx = roleContext(request, 'TRAINER');
    if (ctx instanceof Response) return ctx;
    const found = trainerGroup(ctx, String(params.groupId));
    if (!found) return err(404, 'NOT_FOUND');
    const { group, store } = found;
    const elements = visibleElements(learnerModules(group.courseId!));
    const result: ProgressMatrix = {
      groupId: group.id,
      elements: elements.map((e) => ({ id: e.id, title: e.titleRu, type: e.type })),
      rows: listenersOf(group, store).map((m) => {
        const record = m.userId ? findProgress(group.id, m.userId) : undefined;
        return {
          memberId: m.id,
          userId: m.userId ?? '',
          fullName: m.fullName,
          cells: Object.fromEntries(elements.map((e) => [e.id, elementProgress(e, record?.elements[e.id])])),
        };
      }),
    };
    return HttpResponse.json(result);
  }),

  // Проверка практической работы или рефлексии: «На проверке» → «Выполнено»
  http.post('/api/tenant/trainer/groups/:groupId/progress/:memberId/elements/:elementId/accept', async ({ params, request }) => {
    await latency();
    const ctx = roleContext(request, 'TRAINER');
    if (ctx instanceof Response) return ctx;
    const found = trainerGroup(ctx, String(params.groupId));
    if (!found) return err(404, 'NOT_FOUND');
    const member = listenersOf(found.group, found.store).find((m) => m.id === params.memberId);
    const element = sourceElement(found.group.courseId!, String(params.elementId));
    if (!member || !element || kindOf(element) !== 'work') return err(404, 'NOT_FOUND');
    const store = loadProfileFields();
    const state = member.userId ? findProgress(found.group.id, member.userId, store)?.elements[element.id] : undefined;
    if (!state?.work) return err(400, 'VALIDATION_ERROR', 'Слушатель ещё не отправил работу.');
    state.work.done = true;
    saveProfileFields(store);
    return HttpResponse.json(elementProgress(element, state));
  }),

  // ---------- Конструктор полей профиля (администратор организации) ----------
  http.get('/api/tenant/profile-fields', async ({ request }) => {
    await latency();
    const ctx = builderContext(request, 'custom_fields', 'schemes');
    if (ctx instanceof Response) return ctx;
    return HttpResponse.json(builderData(ctx.org.tenantId));
  }),

  http.put('/api/tenant/profile-fields/globals/:id', async ({ params, request }) => {
    await latency();
    const ctx = builderContext(request, 'custom_fields');
    if (ctx instanceof Response) return ctx;
    const store = loadProfileFields();
    const field = store.globals.find((f) => f.id === params.id && f.active);
    if (!field) return err(404, 'NOT_FOUND');
    const body = (await request.json().catch(() => ({}))) as { active?: boolean };
    const tenantId = ctx.org.tenantId;
    const current = store.tenantActive[tenantId] ?? store.globals.map((f) => f.id);
    const before = current.includes(field.id);
    store.tenantActive[tenantId] = body.active ? [...new Set([...current, field.id])] : current.filter((id) => id !== field.id);
    saveProfileFields(store);
    if (before !== Boolean(body.active))
      audit(ctx, request, 'PROFILE_FIELD_TOGGLED', field.labelRu, [{ field: 'Используется', oldValue: before ? 'Да' : 'Нет', newValue: body.active ? 'Да' : 'Нет' }]);
    return HttpResponse.json(builderData(tenantId));
  }),

  http.post('/api/tenant/profile-fields/custom', async ({ request }) => {
    await latency();
    const ctx = builderContext(request, 'custom_fields');
    if (ctx instanceof Response) return ctx;
    const body = (await request.json().catch(() => ({}))) as Partial<ProfileFieldPayload>;
    const fe = validateField(body, ctx.user.access.includes('lms_profile_field_builder.multilingual_directories'));
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте заполнение полей.', fe);
    const store = loadProfileFields();
    const field: FieldRecord = {
      id: crypto.randomUUID(),
      tenantId: ctx.org.tenantId,
      system: false,
      active: true,
      labelKz: body.labelKz!.trim(),
      labelRu: body.labelRu!.trim(),
      labelEn: body.labelEn!.trim(),
      type: body.type!,
      directoryId: null,
    };
    upsertDirectory(store, field, body);
    store.custom.push(field);
    saveProfileFields(store);
    audit(ctx, request, 'PROFILE_FIELD_CREATED', field.labelRu, [
      { field: 'Тип', oldValue: null, newValue: field.type === 'DROPDOWN' ? 'Выпадающий список' : 'Текст' },
    ]);
    return HttpResponse.json(builderData(ctx.org.tenantId), { status: 201 });
  }),

  http.put('/api/tenant/profile-fields/custom/:id', async ({ params, request }) => {
    await latency();
    const ctx = builderContext(request, 'custom_fields');
    if (ctx instanceof Response) return ctx;
    const store = loadProfileFields();
    const field = store.custom.find((f) => f.id === params.id && f.tenantId === ctx.org.tenantId);
    if (!field) return err(404, 'NOT_FOUND');
    const body = (await request.json().catch(() => ({}))) as Partial<ProfileFieldPayload>;
    const fe = validateField(body, ctx.user.access.includes('lms_profile_field_builder.multilingual_directories'));
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте заполнение полей.', fe);
    const before = field.labelRu;
    const optionsBefore = directoryItems(store, field.directoryId).map((o) => o.labelRu).join(', ') || null;
    field.labelKz = body.labelKz!.trim();
    field.labelRu = body.labelRu!.trim();
    field.labelEn = body.labelEn!.trim();
    field.type = body.type!;
    upsertDirectory(store, field, body);
    saveProfileFields(store);
    audit(ctx, request, 'PROFILE_FIELD_UPDATED', field.labelRu, [
      { field: 'Название', oldValue: before, newValue: field.labelRu },
      { field: 'Справочник', oldValue: optionsBefore, newValue: directoryItems(store, field.directoryId).map((o) => o.labelRu).join(', ') || null },
    ].filter((c) => c.oldValue !== c.newValue));
    return HttpResponse.json(builderData(ctx.org.tenantId));
  }),

  http.delete('/api/tenant/profile-fields/custom/:id', async ({ params, request }) => {
    await latency();
    const ctx = builderContext(request, 'custom_fields');
    if (ctx instanceof Response) return ctx;
    const store = loadProfileFields();
    const field = store.custom.find((f) => f.id === params.id && f.tenantId === ctx.org.tenantId);
    if (!field) return err(404, 'NOT_FOUND');
    store.custom = store.custom.filter((f) => f.id !== field.id);
    store.directories = store.directories.filter((d) => d.id !== field.directoryId);
    for (const scheme of store.schemes) scheme.fields = scheme.fields.filter((r) => r.fieldId !== field.id);
    saveProfileFields(store);
    audit(ctx, request, 'PROFILE_FIELD_DELETED', field.labelRu, [{ field: 'Поле', oldValue: field.labelRu, newValue: null }]);
    return HttpResponse.json(builderData(ctx.org.tenantId));
  }),

  http.post('/api/tenant/profile-fields/schemes', async ({ request }) => {
    await latency();
    const ctx = builderContext(request, 'schemes');
    if (ctx instanceof Response) return ctx;
    const body = (await request.json().catch(() => ({}))) as Partial<ProfileFieldSchemePayload>;
    const fe = validateScheme(ctx.org.tenantId, body);
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте заполнение схемы.', fe);
    ensureDefaultScheme(ctx.org.tenantId);
    const store = loadProfileFields();
    const scheme = { id: crypto.randomUUID(), tenantId: ctx.org.tenantId, name: body.name!.trim(), fields: body.fields!.map((r) => ({ fieldId: r.fieldId, required: Boolean(r.required) })), isDefault: false };
    store.schemes.push(scheme);
    saveProfileFields(store);
    audit(ctx, request, 'PROFILE_SCHEME_CREATED', scheme.name, [{ field: 'Поля', oldValue: null, newValue: rowsText(store, ctx.org.tenantId, scheme.fields) }]);
    return HttpResponse.json(builderData(ctx.org.tenantId), { status: 201 });
  }),

  http.put('/api/tenant/profile-fields/schemes/:id', async ({ params, request }) => {
    await latency();
    const ctx = builderContext(request, 'schemes');
    if (ctx instanceof Response) return ctx;
    ensureDefaultScheme(ctx.org.tenantId);
    const store = loadProfileFields();
    const scheme = store.schemes.find((s) => s.id === params.id && s.tenantId === ctx.org.tenantId);
    if (!scheme) return err(404, 'NOT_FOUND');
    const body = (await request.json().catch(() => ({}))) as Partial<ProfileFieldSchemePayload>;
    const fe = validateScheme(ctx.org.tenantId, body);
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте заполнение схемы.', fe);
    const before = { name: scheme.name, fields: rowsText(store, ctx.org.tenantId, scheme.fields) };
    scheme.name = body.name!.trim();
    scheme.fields = body.fields!.map((r) => ({ fieldId: r.fieldId, required: Boolean(r.required) }));
    saveProfileFields(store);
    audit(ctx, request, 'PROFILE_SCHEME_UPDATED', scheme.name, [
      { field: 'Название', oldValue: before.name, newValue: scheme.name },
      { field: 'Поля', oldValue: before.fields, newValue: rowsText(store, ctx.org.tenantId, scheme.fields) },
    ].filter((c) => c.oldValue !== c.newValue));
    return HttpResponse.json(builderData(ctx.org.tenantId));
  }),

  http.delete('/api/tenant/profile-fields/schemes/:id', async ({ params, request }) => {
    await latency();
    const ctx = builderContext(request, 'schemes');
    if (ctx instanceof Response) return ctx;
    ensureDefaultScheme(ctx.org.tenantId);
    const store = loadProfileFields();
    const scheme = store.schemes.find((s) => s.id === params.id && s.tenantId === ctx.org.tenantId);
    if (!scheme) return err(404, 'NOT_FOUND');
    if (scheme.isDefault) return err(400, 'VALIDATION_ERROR', 'Основную схему удалить нельзя.');
    if (loadStructure().groups.some((g) => g.tenantId === ctx.org.tenantId && g.profileSchemeId === scheme.id))
      return err(400, 'VALIDATION_ERROR', 'Схема привязана к учебным группам. Сначала выберите для них другую схему.');
    store.schemes = store.schemes.filter((s) => s.id !== scheme.id);
    if (store.trainerSchemeByTenant[ctx.org.tenantId] === scheme.id) delete store.trainerSchemeByTenant[ctx.org.tenantId];
    saveProfileFields(store);
    audit(ctx, request, 'PROFILE_SCHEME_DELETED', scheme.name, [{ field: 'Схема', oldValue: scheme.name, newValue: null }]);
    return HttpResponse.json(builderData(ctx.org.tenantId));
  }),

  http.put('/api/tenant/profile-fields/trainer-scheme', async ({ request }) => {
    await latency();
    const ctx = builderContext(request, 'schemes');
    if (ctx instanceof Response) return ctx;
    const body = (await request.json().catch(() => ({}))) as { schemeId?: string | null };
    const schemes = schemesForTenant(ctx.org.tenantId);
    if (body.schemeId && !schemes.some((s) => s.id === body.schemeId)) return err(400, 'VALIDATION_ERROR', 'Схема не найдена.');
    const store = loadProfileFields();
    const name = (id: string | undefined | null) => schemes.find((s) => s.id === id)?.name ?? null;
    const before = name(store.trainerSchemeByTenant[ctx.org.tenantId]);
    if (body.schemeId) store.trainerSchemeByTenant[ctx.org.tenantId] = body.schemeId;
    else delete store.trainerSchemeByTenant[ctx.org.tenantId];
    saveProfileFields(store);
    if (before !== name(body.schemeId)) audit(ctx, request, 'TRAINER_SCHEME_CHANGED', 'Анкета тренера', [{ field: 'Схема', oldValue: before, newValue: name(body.schemeId) }]);
    return HttpResponse.json(builderData(ctx.org.tenantId));
  }),

  // ---------- Реестр глобальных полей (суперадминистратор) ----------
  http.get('/api/superadmin/profile-fields', async () => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const store = loadProfileFields();
    return HttpResponse.json(store.globals.map((f) => toGlobal(store, f)));
  }),

  http.post('/api/superadmin/profile-fields', async ({ request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as Partial<GlobalProfileFieldPayload>;
    const fe = validateField(body, true);
    const store = loadProfileFields();
    if (store.globals.some((f) => f.labelRu.toLowerCase() === String(body.labelRu ?? '').trim().toLowerCase())) fe.labelRu = 'Поле с таким названием уже есть';
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте заполнение полей.', fe);
    const field: FieldRecord = {
      id: crypto.randomUUID(),
      tenantId: null,
      system: true,
      active: body.active ?? true,
      labelKz: body.labelKz!.trim(),
      labelRu: body.labelRu!.trim(),
      labelEn: body.labelEn!.trim(),
      type: body.type!,
      directoryId: null,
      inTrainerProfile: Boolean(body.inTrainerProfile),
      trainerRequired: Boolean(body.inTrainerProfile && body.trainerRequired),
    };
    upsertDirectory(store, field, body);
    store.globals.push(field);
    saveProfileFields(store);
    return HttpResponse.json(toGlobal(store, field), { status: 201 });
  }),

  http.put('/api/superadmin/profile-fields/:id', async ({ params, request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const store = loadProfileFields();
    const field = store.globals.find((f) => f.id === params.id);
    if (!field) return err(404, 'NOT_FOUND');
    const body = (await request.json().catch(() => ({}))) as Partial<GlobalProfileFieldPayload>;
    // Тип поля, связанного с учётной записью (ИИН, ФИО…), не меняется
    const payload = field.source ? { ...body, type: field.type, options: directoryItems(store, field.directoryId) } : body;
    const fe = validateField(payload, true);
    if (store.globals.some((f) => f.id !== field.id && f.labelRu.toLowerCase() === String(body.labelRu ?? '').trim().toLowerCase())) fe.labelRu = 'Поле с таким названием уже есть';
    if (Object.keys(fe).length) return err(400, 'VALIDATION_ERROR', 'Проверьте заполнение полей.', fe);
    field.labelKz = payload.labelKz!.trim();
    field.labelRu = payload.labelRu!.trim();
    field.labelEn = payload.labelEn!.trim();
    field.type = payload.type!;
    field.active = body.active ?? field.active;
    field.inTrainerProfile = Boolean(body.inTrainerProfile);
    field.trainerRequired = Boolean(body.inTrainerProfile && body.trainerRequired);
    upsertDirectory(store, field, payload);
    saveProfileFields(store);
    return HttpResponse.json(toGlobal(store, field));
  }),
];
