/**
 * Внутренняя структура компаний для мок-бэкенда: отделы, сотрудники, локальные роли и журнал аудита.
 * Управляет ею только администратор компании; суперадминистратору данные доступны для чтения.
 * Журнал неизменяем и сохраняется после удаления организации.
 */
import dayjs from 'dayjs';
import type { AuditChange, AuditEntry, AuditEvent, DepartmentKind, OrgGroup, PaymentOrder } from '@/api/types';
import { allLeafKeys } from '@/shared/access';
import { load, type OrgRecord } from './db';
import { loadRegistry } from './registry';
import { DEMO_PASSWORD, hashPassword, loadUsers, saveUsers } from './users';

export interface Department {
  id: string;
  tenantId: string;
  parentId: string | null;
  name: string;
  kind: DepartmentKind;
  headMemberId: string | null;
}

export interface Member {
  id: string;
  tenantId: string;
  /** Учётная запись сотрудника. Демо-сотрудники получают её при первом открытии кабинета организации */
  userId?: string;
  fullName: string;
  email: string;
  departmentId: string | null;
  localRoleIds: string[];
  /** Активная учётная запись: неактивные не входят в «Количество сотрудников» */
  active: boolean;
}

export interface LocalRole {
  id: string;
  tenantId: string;
  /** Название на русском */
  name: string;
  nameKz: string;
  description: string;
  /** Роль действует на весь отдел или на выбранных сотрудников */
  scope: 'DEPARTMENT' | 'MEMBERS';
  departmentId: string | null;
  matrix: string[];
  createdAt: string;
}

export interface TrainerEntry {
  id: string;
  tenantId: string;
  userId: string;
  active: boolean;
  assignedAt: string;
  specialization: string;
}

interface Store {
  departments: Department[];
  members: Member[];
  roles: LocalRole[];
  /** Пул тренеров организации */
  trainers: TrainerEntry[];
  groups: (OrgGroup & { tenantId: string })[];
  /** Заказы на оплату: одна оплата продлевает подписку один раз */
  payments: (PaymentOrder & { tenantId: string; status: 'PENDING' | 'PAID' | 'DECLINED'; annualAmount: number; monthlyAmount: number })[];
  /** Новые записи сверху */
  audit: AuditEntry[];
}

const STORAGE_KEY = 'superadmin-mock-org-structure-v4';

const EMPLOYEES = [
  'Ержанова Динара',
  'Ким Руслан',
  'Абдрахманов Ерлан',
  'Исаева Гульнара',
  'Сейткали Арман',
  'Петрова Ольга',
  'Тулегенов Бауыржан',
  'Омарова Жанар',
  'Смагулов Даурен',
];

const ROLE_TEMPLATES: { name: string; nameKz: string; department: number; modules: string[] }[] = [
  { name: 'Руководитель филиала', nameKz: 'Филиал басшысы', department: 3, modules: ['lms_users', 'lms_departments', 'lms_groups', 'lms_report_builder'] },
  { name: 'Методист', nameKz: 'Әдіскер', department: 1, modules: ['lms_prog_core', 'lms_element_text', 'lms_element_test'] },
  { name: 'Куратор курса', nameKz: 'Курс кураторы', department: 1, modules: ['lms_groups.view', 'lms_groups.add_members_manual', 'lms_prog_core.view'] },
];

export const adminIdOf = (slug: string) => (slug === 'academy' ? 'u-2' : `adm-${slug}`);

const entry = (
  at: string,
  org: { tenantId: string; name: string; clientSlug: string },
  event: AuditEvent,
  target: string,
  changes: AuditChange[],
): AuditEntry => ({
  id: crypto.randomUUID(),
  at,
  tenantId: org.tenantId,
  organizationName: org.name,
  adminId: adminIdOf(org.clientSlug),
  event,
  target,
  changes,
});

/** Начальные данные: каждая вторая организация уже настроила структуру (Academy — всегда) */
function seed(): Store {
  const store: Store = { departments: [], members: [], roles: [], trainers: [], groups: [], payments: [], audit: [] };
  const options = allLeafKeys(loadRegistry());
  const orgs = [...load().organizations].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const now = dayjs();
  orgs
    .filter((o, i) => o.clientSlug === 'academy' || i % 2 === 0)
    .forEach((org, n) => {
      const id = (suffix: string) => `${org.tenantId}-${suffix}`;
      const tenantId = org.tenantId;
      const depts: Department[] = [
        { id: id('d0'), tenantId, parentId: null, name: 'Головной офис', kind: 'DEPARTMENT', headMemberId: null },
        { id: id('d1'), tenantId, parentId: id('d0'), name: 'Учебный отдел', kind: 'MANAGEMENT', headMemberId: null },
        { id: id('d2'), tenantId, parentId: id('d1'), name: 'Методический кабинет', kind: 'UNIT', headMemberId: null },
        { id: id('d3'), tenantId, parentId: id('d0'), name: 'Филиал в Алматы', kind: 'BRANCH', headMemberId: null },
      ];
      store.departments.push(...depts);

      const start = now.subtract(60 + n * 3, 'day').hour(10).minute(0).second(0).millisecond(0);
      const roles = ROLE_TEMPLATES.map((t, i): LocalRole => {
        const role: LocalRole = {
          id: id(`r${i}`),
          tenantId,
          name: t.name,
          nameKz: t.nameKz,
          description: '',
          scope: 'MEMBERS',
          departmentId: depts[t.department]!.id,
          matrix: options.filter((k) => t.modules.some((m) => k === m || k.startsWith(`${m}.`))),
          createdAt: start.add(i, 'day').toISOString(),
        };
        store.audit.push(
          entry(role.createdAt, org, 'ROLE_CREATED', role.name, [
            { field: 'Название', oldValue: null, newValue: role.name },
            { field: 'Отдел', oldValue: null, newValue: depts[t.department]!.name },
            { field: 'Опций в матрице', oldValue: null, newValue: String(role.matrix.length) },
          ]),
        );
        return role;
      });
      store.roles.push(...roles);

      EMPLOYEES.forEach((fullName, i) => {
        const role = roles[i % roles.length]!;
        const member: Member = {
          id: id(`m${i}`),
          tenantId,
          fullName,
          email: `employee${i + 1}@${org.clientSlug}.kz`,
          departmentId: i === EMPLOYEES.length - 1 ? null : role.departmentId,
          localRoleIds: [role.id],
          active: i !== 3,
        };
        store.members.push(member);
        if (member.departmentId)
          store.audit.push(
            entry(start.add(5, 'day').add(i, 'hour').toISOString(), org, 'USER_BOUND_TO_DEPARTMENT', fullName, [
              { field: 'Отдел', oldValue: null, newValue: depts.find((d) => d.id === member.departmentId)!.name },
            ]),
          );
      });

      store.audit.push(
        entry(start.add(10, 'day').toISOString(), org, 'ROLE_MATRIX_CHANGED', roles[2]!.name, [
          { field: 'Выключены опции', oldValue: 'lms_groups.edit', newValue: null },
          { field: 'Включены опции', oldValue: null, newValue: 'lms_groups.add_members_manual' },
        ]),
      );
    });
  store.audit.sort((a, b) => b.at.localeCompare(a.at));
  return store;
}

let memory: Store | null = null;

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadStructure(): Store {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (raw) {
      memory = JSON.parse(raw) as Store;
      return memory;
    }
  } catch {
    /* повреждённые данные — пересоздаём */
  }
  if (!memory) saveStructure(seed());
  return memory!;
}

export function saveStructure(store: Store) {
  memory = store;
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* остаёмся в памяти */
  }
}

export function resetOrgStructure() {
  memory = null;
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Запись в журнал аудита от имени администратора компании */
export function addAudit(
  store: Store,
  org: { tenantId: string; name: string },
  adminId: string,
  event: AuditEvent,
  target: string,
  changes: AuditChange[],
) {
  store.audit.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    tenantId: org.tenantId,
    organizationName: org.name,
    adminId,
    event,
    target,
    // Параметры без значений до и после не несут информации
    changes: changes.filter((c) => c.oldValue !== null || c.newValue !== null),
  });
}

/** Удаление организации убирает её структуру; записи журнала сохраняются */
export function removeStructure(tenantId: string) {
  const store = loadStructure();
  store.departments = store.departments.filter((d) => d.tenantId !== tenantId);
  store.members = store.members.filter((m) => m.tenantId !== tenantId);
  store.roles = store.roles.filter((r) => r.tenantId !== tenantId);
  store.trainers = store.trainers.filter((t) => t.tenantId !== tenantId);
  store.groups = store.groups.filter((g) => g.tenantId !== tenantId);
  store.payments = store.payments.filter((p) => p.tenantId !== tenantId);
  saveStructure(store);
}

/** Сотрудники, у которых действует локальная роль: выбранные лично или весь привязанный отдел */
export function roleHolders(store: Store, role: LocalRole): Member[] {
  return store.members.filter(
    (m) =>
      m.tenantId === role.tenantId &&
      m.active &&
      (m.localRoleIds.includes(role.id) || (role.scope === 'DEPARTMENT' && role.departmentId !== null && m.departmentId === role.departmentId)),
  );
}

/** Матрицы локальных ролей пользователя в организации */
export function localMatrixOf(userId: string, clientSlug: string): string[] {
  const org = load().organizations.find((o) => o.clientSlug === clientSlug);
  if (!org) return [];
  const store = loadStructure();
  const member = store.members.find((m) => m.tenantId === org.tenantId && m.userId === userId);
  if (!member) return [];
  return store.roles.filter((r) => r.tenantId === org.tenantId && roleHolders(store, r).includes(member)).flatMap((r) => r.matrix);
}

/** Тренер деактивирован в пуле организации: закрыт только интерфейс тренера */
export function isTrainerDeactivated(userId: string, clientSlug: string): boolean {
  const org = load().organizations.find((o) => o.clientSlug === clientSlug);
  if (!org) return false;
  return loadStructure().trainers.some((t) => t.tenantId === org.tenantId && t.userId === userId && !t.active);
}

/** Сотрудник деактивирован в организации: роли этой организации не действуют */
export function isDeactivated(userId: string, clientSlug: string): boolean {
  const org = load().organizations.find((o) => o.clientSlug === clientSlug);
  if (!org) return false;
  return loadStructure().members.some((m) => m.tenantId === org.tenantId && m.userId === userId && !m.active);
}

function nextIin(taken: Set<string>): string {
  for (let n = taken.size; ; n++) {
    const digits = `9001014${String(n % 10000).padStart(4, '0')}`;
    const d = [...digits].map(Number);
    const sum = (w: number[]) => w.reduce((acc, x, i) => acc + x * d[i]!, 0) % 11;
    let check = sum([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    if (check === 10) check = sum([3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2]);
    const iin = `${digits}${check}`;
    if (check !== 10 && !taken.has(iin)) return iin;
  }
}

/**
 * Сверка сотрудников с учётными записями. Пользователи организации получают запись сотрудника
 * (суперадминистраторы в организации не отображаются); с materialize демо-сотрудники получают учётные записи.
 */
export function syncMembers(org: OrgRecord, materialize = false): Store {
  const store = loadStructure();
  const users = loadUsers();
  const inOrg = (u: (typeof users)[number]) =>
    u.roles.some((r) => r.clientSlug === org.clientSlug) && !u.roles.some((r) => r.role === 'SUPERADMIN');
  const name = (u: (typeof users)[number]) => [u.lastName, u.firstName, u.middleName].filter(Boolean).join(' ');

  store.members = store.members.filter(
    (m) => m.tenantId !== org.tenantId || !m.userId || users.some((u) => u.id === m.userId && inOrg(u)),
  );
  for (const u of users.filter(inOrg)) {
    const member = store.members.find((m) => m.tenantId === org.tenantId && m.userId === u.id);
    if (member) Object.assign(member, { fullName: name(u), email: u.email });
    else
      store.members.push({
        id: crypto.randomUUID(),
        tenantId: org.tenantId,
        userId: u.id,
        fullName: name(u),
        email: u.email,
        departmentId: null,
        localRoleIds: [],
        active: true,
      });
  }
  // Пул тренеров следует за ролью «Тренер» в организации
  const isTrainer = (u: (typeof users)[number]) => inOrg(u) && u.roles.some((r) => r.role === 'TRAINER' && r.clientSlug === org.clientSlug);
  store.trainers = store.trainers.filter((t) => t.tenantId !== org.tenantId || users.some((u) => u.id === t.userId && isTrainer(u)));
  for (const u of users.filter(isTrainer)) {
    if (store.trainers.some((t) => t.tenantId === org.tenantId && t.userId === u.id)) continue;
    store.trainers.push({
      id: crypto.randomUUID(),
      tenantId: org.tenantId,
      userId: u.id,
      active: true,
      assignedAt: new Date().toISOString(),
      specialization: '',
    });
  }
  if (materialize) {
    const taken = new Set(users.map((u) => u.iin));
    let changed = false;
    for (const m of store.members.filter((x) => x.tenantId === org.tenantId && !x.userId)) {
      const [lastName = '', firstName = ''] = m.fullName.split(' ');
      const iin = nextIin(taken);
      taken.add(iin);
      const id = crypto.randomUUID();
      users.push({
        id,
        iin,
        lastName,
        firstName,
        region: 'г. Астана',
        phone: `701${iin.slice(4, 11)}`,
        email: m.email,
        passwordHash: hashPassword(DEMO_PASSWORD),
        roles: [{ role: 'LEARNER', clientSlug: org.clientSlug }],
        failedAttempts: 0,
        profileCompleted: false,
      });
      m.userId = id;
      changed = true;
    }
    if (changed) saveUsers(users);
  }
  saveStructure(store);
  return store;
}
