/**
 * Учётные записи мок-сервера. Хранятся в localStorage отдельно от организаций.
 * Реальный бэкенд хранит ИИН в зашифрованном виде, а пароль — только хэшем Argon2/bcrypt;
 * здесь для демонстрации используется упрощённый хэш.
 */
import type { CurrentUser, Region, Role, RoleAssignment } from '@/api/types';
import { derivePermissions, effectiveAccess } from '@/shared/access';
import { effectiveModules, load } from './db';
import { localMatrixOf } from './orgStructure';
import { matrixOf } from './roles';

export interface UserRecord {
  id: string;
  iin: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  region: string;
  phone: string;
  email: string;
  passwordHash: string;
  roles: { role: Role; customRole?: string; clientSlug?: string }[];
  /** Аватар (data URL) */
  avatar?: string;
  /** false — пользователь ещё не подтвердил профиль при первом входе */
  profileCompleted?: boolean;
  /** Неверные вводы пароля подряд */
  failedAttempts: number;
  /** Временная блокировка входа (ISO) */
  lockedUntil?: string;
}

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

/** Справочник регионов РК: 17 областей и 3 города республиканского значения. */
export const REGIONS: Region[] = [
  'Абайская область',
  'Акмолинская область',
  'Актюбинская область',
  'Алматинская область',
  'Атырауская область',
  'Восточно-Казахстанская область',
  'Жамбылская область',
  'Жетысуская область',
  'Западно-Казахстанская область',
  'Карагандинская область',
  'Костанайская область',
  'Кызылординская область',
  'Мангистауская область',
  'Павлодарская область',
  'Северо-Казахстанская область',
  'Туркестанская область',
  'Улытауская область',
  'г. Астана',
  'г. Алматы',
  'г. Шымкент',
].map((name, i) => ({ code: `KZ-${String(i + 1).padStart(2, '0')}`, name }));

/** Приоритет при входе: Суперадмин > Админ клиента > Тренер > Слушатель. */
export const ROLE_PRIORITY: Role[] = ['SUPERADMIN', 'ORGANIZATION_ADMIN', 'TRAINER', 'CUSTOM', 'LEARNER'];

/** Упрощённый детерминированный хэш (FNV-1a) — только для мок-сервера. */
export function hashPassword(password: string): string {
  let h = 0x811c9dc5;
  for (const ch of `sanastra:${password}`) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv1a$${h.toString(16)}`;
}

export const DEMO_PASSWORD = 'Sanastra1';

function seedUsers(): UserRecord[] {
  const base = { failedAttempts: 0, passwordHash: hashPassword(DEMO_PASSWORD), region: 'г. Астана' };
  return [
    {
      ...base,
      id: 'u-1',
      iin: '850315300128',
      lastName: 'Касымов',
      firstName: 'Нурлан',
      phone: '7011234567',
      email: 'superadmin@sanastra.kz',
      // Роль Superadmin назначена прямой записью в БД при развёртывании; Слушатель — при регистрации
      roles: [{ role: 'SUPERADMIN' }, { role: 'LEARNER' }],
    },
    {
      ...base,
      id: 'u-2',
      iin: '920705400239',
      lastName: 'Сапарова',
      firstName: 'Алия',
      middleName: 'Маратовна',
      phone: '7012345678',
      email: 'admin@academy.kz',
      roles: [{ role: 'ORGANIZATION_ADMIN', clientSlug: 'academy' }, { role: 'LEARNER' }],
    },
    {
      ...base,
      id: 'u-3',
      iin: '951122300340',
      lastName: 'Ахметов',
      firstName: 'Данияр',
      phone: '7013456789',
      email: 'learner@academy.kz',
      roles: [{ role: 'LEARNER', clientSlug: 'academy' }],
    },
    {
      ...base,
      id: 'u-4',
      iin: '880425400455',
      lastName: 'Нурланова',
      firstName: 'Айгерим',
      phone: '7014567890',
      email: 'trainer@academy.kz',
      roles: [{ role: 'TRAINER', clientSlug: 'academy' }, { role: 'LEARNER' }],
    },
    {
      ...base,
      id: 'u-5',
      iin: '900214400513',
      lastName: 'Жумабекова',
      firstName: 'Сауле',
      phone: '7015678901',
      email: 'methodist@academy.kz',
      // Кастомная глобальная роль «Старший методист»
      roles: [{ role: 'CUSTOM', customRole: 'senior_methodist', clientSlug: 'academy' }, { role: 'LEARNER' }],
    },
  ];
}

const STORAGE_KEY = 'superadmin-mock-users-v2';
let memory: UserRecord[] | null = null;

const storage = () => (typeof localStorage === 'undefined' ? null : localStorage);

export function loadUsers(): UserRecord[] {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as UserRecord[];
  } catch {
    /* ignore */
  }
  if (!memory) memory = seedUsers();
  return structuredClone(memory);
}

export function saveUsers(users: UserRecord[]) {
  memory = users;
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(users));
  } catch {
    /* квота / приватный режим — остаёмся в памяти */
  }
}

export function resetUsers() {
  memory = seedUsers();
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  saveUsers(memory);
}

export const fullNameOf = (u: Pick<UserRecord, 'lastName' | 'firstName' | 'middleName'>) =>
  [u.lastName, u.firstName, u.middleName].filter(Boolean).join(' ');

type AssignmentKey = Pick<RoleAssignment, 'role' | 'clientSlug' | 'customRole'>;

export const sameAssignment = (a: AssignmentKey, b: AssignmentKey) =>
  a.role === b.role &&
  (a.clientSlug ?? null) === (b.clientSlug ?? null) &&
  (a.role !== 'CUSTOM' || (a.customRole ?? null) === (b.customRole ?? null));

/**
 * Итоговый доступ в рабочем контексте: матрица глобальной роли ∩ модули тарифа организации.
 * Вне организации (суперадмин, личный кабинет) тарифа нет — действует только матрица.
 */
export function accessFor(active: AssignmentKey, userId?: string): string[] {
  const own = matrixOf(active.role, active.customRole);
  if (!active.clientSlug) return own;
  // Локальные роли компании добавляют только то, что разрешено глобальной ролью администратора
  const delegable = new Set(matrixOf('ORGANIZATION_ADMIN'));
  const local = userId ? localMatrixOf(userId, active.clientSlug).filter((k) => delegable.has(k)) : [];
  const matrix = [...new Set([...own, ...local])];
  const org = load().organizations.find((o) => o.clientSlug === active.clientSlug);
  return org ? effectiveAccess(matrix, effectiveModules(org)) : [];
}

/** Представление пользователя для клиента в выбранном рабочем контексте. */
export function toCurrentUser(
  u: UserRecord,
  active: Pick<RoleAssignment, 'role' | 'clientSlug' | 'customRole' | 'roleName'>,
  roles: RoleAssignment[] = u.roles,
): CurrentUser {
  const access = accessFor(active, u.id);
  const local = active.clientSlug ? localMatrixOf(u.id, active.clientSlug) : [];
  const matrix = [...new Set([...matrixOf(active.role, active.customRole), ...local.filter((k) => access.includes(k))])];
  return {
    id: u.id,
    fullName: fullNameOf(u),
    lastName: u.lastName,
    firstName: u.firstName,
    middleName: u.middleName,
    avatar: u.avatar,
    onboardingRequired: u.profileCompleted === false,
    email: u.email,
    iin: u.iin,
    phone: u.phone,
    region: u.region,
    role: active.role,
    ...(active.role === 'CUSTOM' ? { customRole: active.customRole, roleName: active.roleName } : {}),
    clientSlug: active.clientSlug,
    // Права пересчитываются из текущей матрицы роли при каждом запросе — изменения действуют сразу
    permissions: derivePermissions(active.role, matrix),
    access,
    roles,
  };
}

/** Сессии для тестов: пользователь в своей основной роли. */
export const DEMO_USERS = {
  get SUPERADMIN() {
    return toCurrentUser(seedUsers()[0]!, { role: 'SUPERADMIN' });
  },
  get ORGANIZATION_ADMIN() {
    return toCurrentUser(seedUsers()[1]!, { role: 'ORGANIZATION_ADMIN', clientSlug: 'academy' });
  },
  get LEARNER() {
    return toCurrentUser(seedUsers()[2]!, { role: 'LEARNER', clientSlug: 'academy' });
  },
  get TRAINER() {
    return toCurrentUser(seedUsers()[3]!, { role: 'TRAINER', clientSlug: 'academy' });
  },
  get METHODIST() {
    return toCurrentUser(seedUsers()[4]!, {
      role: 'CUSTOM',
      customRole: 'senior_methodist',
      roleName: 'Старший методист',
      clientSlug: 'academy',
    });
  },
};
