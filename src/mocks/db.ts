/**
 * In-memory «сервер» для разработки без бэкенда. Состояние зеркалируется в localStorage,
 * чтобы изменения переживали перезагрузку и были видны в соседних вкладках.
 */
import dayjs from 'dayjs';
import { resetContent } from './content';
import { resetRegistry } from './registry';
import { resetUsers } from './users';
import type {
  ChangeSource,
  SubscriptionSummary,
  TenantAccess,
  TenantModule,
  TenantUsage,
  UsageState,
  CurrentUser,
  LimitDefinition,
  OrganizationDetail,
  OrganizationListItem,
  OverridePolicy,
  SubscriptionHistoryEntry,
  SubscriptionStatus,
  TariffPlanDetail,
  TariffPlanSummary,
  Discount,
} from '@/api/types';
import { finalPrice, NO_DISCOUNT } from '@/shared/pricing';

interface ModuleDef {
  code: string;
  name: string;
  description: string;
  icon: string;
  /** Право роли, необходимое для работы с модулем */
  permission: string;
  system?: boolean;
}

export const MODULES: ModuleDef[] = [
  { code: 'USERS', name: 'Пользователи', description: 'Учётные записи, роли и приглашения', icon: 'Users', permission: 'users.manage', system: true },
  { code: 'COURSES', name: 'Курсы', description: 'Создание и прохождение учебных курсов', icon: 'BookOpen', permission: 'courses.view' },
  { code: 'SCHEDULE', name: 'Расписание', description: 'Календарь занятий и событий', icon: 'CalendarDays', permission: 'schedule.view' },
  { code: 'REPORTS', name: 'Отчёты', description: 'Аналитика успеваемости и активности', icon: 'ChartColumn', permission: 'reports.view' },
  { code: 'CHAT', name: 'Сообщения', description: 'Чаты между участниками', icon: 'MessageSquare', permission: 'chat.view' },
  { code: 'WEBINARS', name: 'Вебинары', description: 'Онлайн-трансляции и записи', icon: 'Video', permission: 'webinars.view' },
  { code: 'CERTIFICATES', name: 'Сертификаты', description: 'Выдача сертификатов о прохождении', icon: 'FileText', permission: 'certificates.manage' },
];

export const LIMITS: LimitDefinition[] = [
  { code: 'USERS_COUNT', name: 'Количество пользователей', unit: 'пользователей', type: 'integer', min: 1, max: 10000 },
  { code: 'COURSES_COUNT', name: 'Количество курсов', unit: 'курсов', type: 'integer', min: 1, max: 1000 },
  { code: 'STORAGE_GB', name: 'Объём хранилища', unit: 'ГБ', type: 'decimal', min: 0.5, max: 2000 },
];

export interface TariffRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  /** Годовая цена, KZT за 12 месяцев */
  annualPrice: number;
  modules: Record<string, boolean>;
  limits: Record<string, number>;
  overridePolicies: OverridePolicy[];
}

/** Начальный справочник tariff_plans; дальше тарифы живут в мок-БД и редактируются в конструкторе. */
export const TARIFFS: TariffRecord[] = [
  {
    id: 'a1f0c3d2-0001-4a00-9000-000000000001',
    code: 'basic',
    name: 'Базовый',
    description: 'Для небольших учебных центров',
    annualPrice: 100_000,
    modules: { USERS: true, COURSES: true, SCHEDULE: true, REPORTS: false, CHAT: false, WEBINARS: false, CERTIFICATES: false },
    limits: { USERS_COUNT: 150, COURSES_COUNT: 10, STORAGE_GB: 10 },
    overridePolicies: ['RESET'],
  },
  {
    id: 'a1f0c3d2-0002-4a00-9000-000000000002',
    code: 'standard',
    name: 'Стандарт',
    description: 'Оптимальный набор для школ',
    annualPrice: 200_000,
    modules: { USERS: true, COURSES: true, SCHEDULE: true, REPORTS: true, CHAT: true, WEBINARS: false, CERTIFICATES: false },
    limits: { USERS_COUNT: 100, COURSES_COUNT: 50, STORAGE_GB: 100 },
    overridePolicies: ['KEEP_COMPATIBLE', 'RESET'],
  },
  {
    id: 'a1f0c3d2-0003-4a00-9000-000000000003',
    code: 'business',
    name: 'Бизнес',
    description: 'Все модули и расширенные лимиты',
    annualPrice: 300_000,
    modules: { USERS: true, COURSES: true, SCHEDULE: true, REPORTS: true, CHAT: true, WEBINARS: true, CERTIFICATES: true },
    limits: { USERS_COUNT: 1000, COURSES_COUNT: 500, STORAGE_GB: 1000 },
    overridePolicies: ['KEEP_COMPATIBLE', 'RESET'],
  },
];

export interface OrgRecord {
  tenantId: string;
  name: string;
  clientSlug: string;
  tariffPlanId: string;
  subscriptionEnabled: boolean;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  moduleOverrides: Record<string, boolean | null>;
  /** Срок действия модулей, включённых сверх тарифа (ISO date-time, null — бессрочно) */
  moduleExpirations: Record<string, string | null>;
  /** Условия текущего периода — снимок тарифа на момент оформления / продления / смены тарифа */
  annualPrice: number;
  limits: Record<string, number>;
  discount: Discount;
  /** Неизменяемая история периодов подписки, новые записи — первыми */
  history: SubscriptionHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  updatedBy: ChangeSource;
  version: number;
  /** Текущее использование лимитов (считает сервер) */
  usage: Record<string, number>;
}

interface DbState {
  tariffs: TariffRecord[];
  organizations: OrgRecord[];
}

const STORAGE_KEY = 'superadmin-mock-db-v3';
const SESSION_KEY = 'superadmin-mock-session';

/** За сколько дней предупреждать об окончании подписки — «конфигурация backend». */
export const EXPIRY_WARNING_DAYS = 14;

const ORG_NAMES: [string, string][] = [
  ['Academy', 'academy'],
  ['Школа программирования «Код»', 'kod-school'],
  ['Лицей №165', 'lyceum-165'],
  ['Международная академия бизнеса', 'iab'],
  ['Онлайн-школа английского Speak Up', 'speak-up'],
  ['Учебный центр «Сапа»', 'sapa'],
  ['IT-колледж Алматы', 'it-college-almaty'],
  ['Медицинский колледж «Денсаулык»', 'densaulyk'],
  ['Школа дизайна Pixel', 'pixel-design'],
  ['Гимназия «Білім»', 'bilim-gymnasium'],
  ['Курсы бухгалтерии «Баланс»', 'balance-courses'],
  ['Академия робототехники', 'robo-academy'],
  ['Центр подготовки к ЕНТ', 'ent-center'],
  ['Музыкальная школа «Домбыра»', 'dombyra'],
  ['Корпоративный университет «Астана Энерго»', 'astana-energo-cu'],
  ['Школа математики «Пифагор»', 'pythagoras'],
  ['Языковой центр Polyglot', 'polyglot'],
  ['Колледж сервиса и туризма', 'service-tourism'],
  ['Data Science Bootcamp', 'ds-bootcamp'],
  ['Детский клуб «Умка»', 'umka-club'],
  ['Школа шахмат «Гамбит»', 'gambit-chess'],
  ['Учебный центр «Профи»', 'profi-center'],
  ['Академия цифрового маркетинга', 'digital-marketing'],
  ['Назарбаев Интеллектуальная школа (пилот)', 'nis-pilot'],
  ['Школа финансовой грамотности', 'fin-literacy'],
  ['Автошкола «Жол»', 'zhol-drive'],
  ['Колледж нефти и газа', 'oil-gas-college'],
  ['Школа UX/UI «Макет»', 'maket-ux'],
  ['Центр повышения квалификации учителей', 'teacher-cpd'],
  ['Онлайн-школа Qazaq Tili', 'qazaq-tili'],
  ['Спортивная академия «Барыс»', 'barys-sport'],
  ['Школа биологии BioLab', 'biolab'],
  ['Учебный центр «Старт»', 'start-center'],
  ['Академия кибербезопасности', 'cyber-academy'],
  ['Художественная студия «Палитра»', 'palitra-art'],
];

function pad(n: number, len: number) {
  return String(n).padStart(len, '0');
}

function seed(): DbState {
  const today = dayjs().startOf('day');
  const organizations = ORG_NAMES.map(([name, slug], i): OrgRecord => {
    const tariff = TARIFFS[i % 3]!;
    const kind = i === 0 ? 0 : i % 7; // academy — всегда активна
    let start = today.subtract(30 + i * 9, 'day');
    let end = start.add(1, 'year');
    let enabled = true;
    if (kind === 3) end = today.subtract(5 + i, 'day'); // истекла
    if (kind === 5) enabled = false; // заблокирована вручную
    if (kind === 6 && i % 2 === 0) {
      start = today.add(10, 'day'); // начнётся в будущем
      end = start.add(1, 'year');
    }
    const created = (i === 0 ? today.subtract(3, 'day') : today.subtract(200 - i * 5, 'day')).hour(9 + (i % 8)).minute((i * 7) % 60);
    const moduleOverrides: Record<string, boolean | null> = {};
    const moduleExpirations: Record<string, string | null> = {};
    if (i === 0) moduleOverrides.WEBINARS = true;
    if (i % 4 === 1) moduleOverrides.CHAT = !tariff.modules.CHAT;
    if (i % 4 === 1 && !tariff.modules.CHAT) moduleExpirations.CHAT = today.add(20 + i, 'day').hour(18).toISOString();
    const discount: Discount =
      i % 5 === 2 ? { type: 'PERCENT', value: 10 } : i % 5 === 4 ? { type: 'AMOUNT', value: 20_000 } : NO_DISCOUNT;

    const history: SubscriptionHistoryEntry[] = [];
    const addEntry = (
      operation: SubscriptionHistoryEntry['operation'],
      from: dayjs.Dayjs,
      to: dayjs.Dayjs,
      d: Discount,
      t: TariffRecord,
    ) =>
      history.unshift({
        id: `h-${i + 1}-${history.length + 1}`,
        operation,
        operationAt: (from.isAfter(today) ? today : from).hour(10).toISOString(),
        tariffName: t.name,
        periodStart: from.format('YYYY-MM-DD'),
        periodEnd: to.format('YYYY-MM-DD'),
        basePrice: t.annualPrice,
        discount: d,
        finalPrice: finalPrice(t.annualPrice, d),
        status: 'ACTIVE',
        source: 'SUPERADMIN',
      });
    // У части организаций есть предыдущий (завершённый) период
    if (i % 3 === 0) {
      const prev = i === 0 ? tariff : TARIFFS[(i + 2) % 3]!;
      addEntry('ACTIVATION', start.subtract(1, 'year'), start.subtract(1, 'day'), NO_DISCOUNT, prev);
      addEntry(prev.id === tariff.id ? 'RENEWAL' : 'TARIFF_CHANGE', start, end, discount, tariff);
    } else {
      addEntry('ACTIVATION', start, end, discount, tariff);
    }
    history.forEach((h, idx) => (h.status = idx === 0 ? 'ACTIVE' : 'COMPLETED'));

    return {
      tenantId: `7c9e6679-7425-40de-944b-${pad(i + 1, 12)}`,
      name,
      clientSlug: slug,
      tariffPlanId: tariff.id,
      subscriptionEnabled: enabled,
      subscriptionStartDate: start.format('YYYY-MM-DD'),
      subscriptionEndDate: end.format('YYYY-MM-DD'),
      moduleOverrides,
      moduleExpirations,
      annualPrice: tariff.annualPrice,
      limits: { ...tariff.limits },
      discount,
      history,
      createdAt: created.toISOString(),
      updatedAt: created.add(1, 'day').toISOString(),
      updatedBy: 'SUPERADMIN',
      version: 1,
      usage:
        i === 0
          ? { USERS_COUNT: 82, COURSES_COUNT: 9, STORAGE_GB: 4.2 }
          : { USERS_COUNT: 10 + i, COURSES_COUNT: 2 + (i % 5), STORAGE_GB: 1 + (i % 4) },
    };
  });
  return { tariffs: structuredClone(TARIFFS), organizations };
}

let memory: DbState | null = null;

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function load(): DbState {
  const s = storage();
  if (s) {
    try {
      const raw = s.getItem(STORAGE_KEY);
      if (raw) {
        memory = JSON.parse(raw) as DbState;
        return memory;
      }
    } catch {
      /* повреждённые данные — пересоздаём */
    }
  }
  if (!memory) memory = seed();
  return memory;
}

export function save(state: DbState) {
  memory = state;
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* квота / приватный режим — остаёмся в памяти */
  }
}

export function resetDb() {
  memory = seed();
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  save(memory);
  setSession(null);
  resetContent();
  resetUsers();
  resetRegistry();
}

export const findTariff = (id: string) => load().tariffs.find((t) => t.id === id);

/** Итоговый статус вычисляется только на сервере. Дата окончания включительна. */
export function computeStatus(o: OrgRecord): SubscriptionStatus {
  const today = dayjs().format('YYYY-MM-DD');
  if (!o.subscriptionEnabled) return 'BLOCKED';
  if (o.subscriptionEndDate < today) return 'EXPIRED';
  if (o.subscriptionStartDate > today) return 'BLOCKED';
  return 'ACTIVE';
}

export function effectiveModules(o: OrgRecord): string[] {
  const t = findTariff(o.tariffPlanId)!;
  return MODULES.filter((m) => o.moduleOverrides[m.code] ?? t.modules[m.code] ?? false).map((m) => m.code);
}

export function toDetail(o: OrgRecord): OrganizationDetail {
  const t = findTariff(o.tariffPlanId)!;
  return {
    tenantId: o.tenantId,
    name: o.name,
    clientSlug: o.clientSlug,
    status: computeStatus(o),
    tariffPlan: { id: t.id, code: t.code, name: t.name },
    subscriptionEnabled: o.subscriptionEnabled,
    subscriptionStartDate: o.subscriptionStartDate,
    subscriptionEndDate: o.subscriptionEndDate,
    modules: MODULES.map((m) => {
      const tariffEnabled = t.modules[m.code] ?? false;
      const overrideEnabled = m.system ? null : (o.moduleOverrides[m.code] ?? null);
      return {
        expiresAt: overrideEnabled === true && !tariffEnabled ? (o.moduleExpirations[m.code] ?? null) : null,
        code: m.code,
        name: m.name,
        description: m.description,
        icon: m.icon,
        tariffEnabled,
        overrideEnabled,
        effectiveEnabled: overrideEnabled ?? tariffEnabled,
        canOverride: !m.system,
        lockReason: m.system ? 'Системный модуль обязателен для работы Sanastra' : undefined,
      };
    }),
    limits: LIMITS.map((l) => ({ ...l, value: o.limits[l.code] ?? l.min })),
    pricing: { annualPrice: o.annualPrice, discount: o.discount, finalPrice: finalPrice(o.annualPrice, o.discount) },
    history: o.history,
    usage: toUsage(o).items,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    updatedBy: o.updatedBy,
    version: o.version,
  };
}

export function toListItem(o: OrgRecord): OrganizationListItem {
  const t = findTariff(o.tariffPlanId);
  return {
    tenantId: o.tenantId,
    name: o.name,
    clientSlug: o.clientSlug,
    status: computeStatus(o),
    tariffPlan: t ? { id: t.id, code: t.code, name: t.name } : null,
    subscriptionStartDate: o.subscriptionStartDate,
    subscriptionEndDate: o.subscriptionEndDate,
    activeModulesCount: effectiveModules(o).length,
    modulesCount: MODULES.length,
    createdAt: o.createdAt,
  };
}

export function toTariffSummary(t: TariffRecord): TariffPlanSummary {
  return {
    id: t.id,
    code: t.code,
    name: t.name,
    description: t.description,
    annualPrice: t.annualPrice,
    limits: t.limits,
    enabledModulesCount: MODULES.filter((m) => t.modules[m.code]).length,
    organizationsCount: load().organizations.filter((o) => o.tariffPlanId === t.id).length,
  };
}

export function toTariffDetail(t: TariffRecord): TariffPlanDetail {
  const summary: Omit<TariffPlanSummary, 'limits'> & { limits?: unknown } = { ...toTariffSummary(t) };
  delete summary.limits;
  return {
    ...summary,
    overridePolicies: t.overridePolicies,
    modules: MODULES.map((m) => ({
      code: m.code,
      name: m.name,
      description: m.description,
      icon: m.icon,
      enabled: t.modules[m.code] ?? false,
      canOverride: !m.system,
      lockReason: m.system ? 'Системный модуль обязателен для работы Sanastra' : undefined,
    })),
    limits: LIMITS.map((l) => ({ ...l, value: t.limits[l.code] ?? l.min })),
  };
}

/**
 * Сессия хранится в sessionStorage — отдельно для каждой вкладки,
 * чтобы в соседних вкладках можно было работать под разными пользователями.
 */
let memorySession: CurrentUser | null = null;
export function getSession(): CurrentUser | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as CurrentUser) : null;
    }
  } catch {
    /* ignore */
  }
  return memorySession;
}
export function setSession(user: CurrentUser | null) {
  memorySession = user;
  try {
    if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export { DEMO_USERS } from './users';

// ---------- Представления для кабинета организации (только эффективные значения) ----------

export function daysLeft(o: OrgRecord): number {
  return Math.max(0, dayjs(o.subscriptionEndDate).diff(dayjs().startOf('day'), 'day') + 1);
}

/** Лимиты фиксированы условиями тарифа текущего периода */
export function effectiveLimitValues(o: OrgRecord): Record<string, number> {
  return Object.fromEntries(LIMITS.map((l) => [l.code, o.limits[l.code] ?? l.min]));
}

export function toAccess(o: OrgRecord): TenantAccess {
  const t = findTariff(o.tariffPlanId)!;
  return {
    tenantId: o.tenantId,
    clientSlug: o.clientSlug,
    organizationName: o.name,
    subscriptionStatus: computeStatus(o),
    tariff: { code: t.code, name: t.name },
    subscriptionStartDate: o.subscriptionStartDate,
    subscriptionEndDate: o.subscriptionEndDate,
    daysLeft: daysLeft(o),
    expiryWarningDays: EXPIRY_WARNING_DAYS,
    enabledModules: effectiveModules(o),
    effectiveLimits: effectiveLimitValues(o),
    configVersion: o.version,
    updatedAt: o.updatedAt,
  };
}

export function toSummary(o: OrgRecord): SubscriptionSummary {
  const t = findTariff(o.tariffPlanId)!;
  return {
    organizationName: o.name,
    status: computeStatus(o),
    tariff: { name: t.name, description: t.description },
    subscriptionStartDate: o.subscriptionStartDate,
    subscriptionEndDate: o.subscriptionEndDate,
    daysLeft: daysLeft(o),
    expiryWarningDays: EXPIRY_WARNING_DAYS,
    updatedAt: o.updatedAt,
    configVersion: o.version,
  };
}

export function toTenantModules(o: OrgRecord): TenantModule[] {
  const enabled = effectiveModules(o);
  return MODULES.filter((m) => enabled.includes(m.code)).map((m) => ({
    code: m.code,
    name: m.name,
    description: m.description,
    icon: m.icon,
    requiredPermission: m.permission,
  }));
}

export function usageState(used: number, limit: number): UsageState {
  if (used >= limit) return 'EXHAUSTED';
  const pct = (used / limit) * 100;
  if (pct >= 95) return 'CRITICAL';
  if (pct >= 80) return 'WARNING';
  return 'NORMAL';
}

export function toUsage(o: OrgRecord): TenantUsage {
  const limits = effectiveLimitValues(o);
  return {
    configVersion: o.version,
    items: LIMITS.map((l) => {
      const used = o.usage[l.code] ?? 0;
      const limit = limits[l.code]!;
      return {
        code: l.code,
        name: l.name,
        used,
        limit,
        remaining: Math.max(0, Math.round((limit - used) * 100) / 100),
        unit: l.unit,
        state: usageState(used, limit),
      };
    }),
  };
}
