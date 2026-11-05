/**
 * Учётные записи мок-сервера. Хранятся в localStorage отдельно от организаций.
 * Реальный бэкенд хранит ИИН в зашифрованном виде, а пароль — только хэшем Argon2/bcrypt;
 * здесь для демонстрации используется упрощённый хэш.
 */
import type { CurrentUser, Region, Role, RoleAssignment } from '@/api/types';

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
  roles: { role: Role; clientSlug?: string }[];
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

/** Права ролей (не зависят от тарифа). */
const LEARNER_PERMISSIONS = ['courses.view', 'schedule.view', 'chat.view', 'webinars.view'];
const TRAINER_PERMISSIONS = [...LEARNER_PERMISSIONS, 'courses.manage', 'reports.view'];
const ALL_PERMISSIONS = [
  'users.manage',
  'courses.view',
  'schedule.view',
  'reports.view',
  'chat.view',
  'webinars.view',
  'certificates.manage',
  'courses.manage',
];
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  SUPERADMIN: ALL_PERMISSIONS,
  ORGANIZATION_ADMIN: [...ALL_PERMISSIONS, 'organization.manage'],
  TRAINER: TRAINER_PERMISSIONS,
  LEARNER: LEARNER_PERMISSIONS,
};

/** Приоритет при входе: Суперадмин > Админ клиента > Тренер > Слушатель. */
export const ROLE_PRIORITY: Role[] = ['SUPERADMIN', 'ORGANIZATION_ADMIN', 'TRAINER', 'LEARNER'];

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
  ];
}

const STORAGE_KEY = 'superadmin-mock-users-v1';
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

export const sameAssignment = (a: Pick<RoleAssignment, 'role' | 'clientSlug'>, b: Pick<RoleAssignment, 'role' | 'clientSlug'>) =>
  a.role === b.role && (a.clientSlug ?? null) === (b.clientSlug ?? null);

/** Представление пользователя для клиента в выбранном рабочем контексте. */
export function toCurrentUser(
  u: UserRecord,
  active: Pick<RoleAssignment, 'role' | 'clientSlug'>,
  roles: RoleAssignment[] = u.roles,
): CurrentUser {
  return {
    id: u.id,
    fullName: fullNameOf(u),
    email: u.email,
    iin: u.iin,
    phone: u.phone,
    region: u.region,
    role: active.role,
    clientSlug: active.clientSlug,
    permissions: ROLE_PERMISSIONS[active.role],
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
};
