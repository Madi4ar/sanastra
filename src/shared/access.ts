/**
 * Ролевая модель: матрица глобальной роли (опции Реестра модулей) и её пересечение с тарифом.
 * Итоговый доступ пользователя = Матрица глобальной роли ∩ Состав модулей тарифа организации.
 */
import type { RegistryModule, RegistryOption, Role } from '@/api/types';
import { ADVANCED_DIRECTORIES, ADVANCED_DIRECTORIES_MODULE, DIRECTORIES, directoryModuleKey } from './directories';

const ELEMENT_TYPE_KEYS = [
  'text',
  'video',
  'interactive_video',
  'audio',
  'document',
  'presentation',
  'folder',
  'image',
  'link',
  'scorm',
  'assignment',
  'table',
  'test',
  'survey',
  'reflection',
];

/** Модуль реестра для типа элемента контента: «Модуль: Лонгрид» → lms_element_text */
export const elementModuleKey = (type: string) => `lms_element_${type}`;

/** Модуль тарифа с интерактивными элементами контента; остальные элементы входят в модуль «Курсы» */
export const ADVANCED_CONTENT_MODULE = 'ADV_CONTENT';
export const ADVANCED_ELEMENT_TYPES: readonly string[] = ['interactive_video', 'scorm', 'table'];

/**
 * Модуль тарифа, в составе которого поставляется модуль Реестра.
 * null — базовая функциональность платформы, доступна при любом тарифе.
 */
export const TARIFF_MODULE_OF: Record<string, string | null> = {
  lms_prog_core: 'COURSES',
  ...Object.fromEntries(
    ELEMENT_TYPE_KEYS.map((t) => [elementModuleKey(t), ADVANCED_ELEMENT_TYPES.includes(t) ? ADVANCED_CONTENT_MODULE : 'COURSES']),
  ),
  // Справочники доступны при любом тарифе, расширенные классификаторы — с отдельным модулем тарифа
  ...Object.fromEntries(
    DIRECTORIES.map((d) => [
      directoryModuleKey(d.code),
      (ADVANCED_DIRECTORIES as readonly string[]).includes(d.code) ? ADVANCED_DIRECTORIES_MODULE : null,
    ]),
  ),
  lms_groups: 'COURSES',
  lms_course_showcase: 'COURSES',
  lms_users: 'USERS',
  lms_trainers: 'USERS',
  lms_roles: 'USERS',
  lms_departments: 'USERS',
  lms_report_builder: 'REPORTS',
  lms_chat: 'CHAT',
  lms_certificates: 'CERTIFICATES',
  lms_learner_cabinet: null,
  lms_trainer_cabinet: null,
};

export const moduleOfKey = (key: string) => key.split('.')[0] ?? key;

/** Модуль Реестра входит в тариф, если включён его модуль тарифа (неизвестные модули — нет) */
export function inTariff(registryModule: string, enabledTariffModules: readonly string[]): boolean {
  if (!(registryModule in TARIFF_MODULE_OF)) return false;
  const tariffModule = TARIFF_MODULE_OF[registryModule];
  return tariffModule === null || enabledTariffModules.includes(tariffModule!);
}

/** Итоговый доступ: опции матрицы, чей модуль входит в тариф организации */
export function effectiveAccess(matrix: readonly string[], enabledTariffModules: readonly string[]): string[] {
  return matrix.filter((key) => inTariff(moduleOfKey(key), enabledTariffModules));
}

/** Модули Реестра, в которых включена хотя бы одна опция */
export const modulesOf = (keys: readonly string[]) => [...new Set(keys.map(moduleOfKey))];

/** Полные ключи атомарных опций (листьев) узла Реестра */
export function leafKeys(nodes: readonly (RegistryOption | RegistryModule)[]): string[] {
  return nodes.flatMap((n) => (n.options?.length ? leafKeys(n.options) : 'version' in n ? [] : [n.key]));
}

export const allLeafKeys = (modules: readonly RegistryModule[]) => modules.flatMap((m) => leafKeys(m.options));

const has = (keys: readonly string[], prefix: string) => keys.some((k) => k === prefix || k.startsWith(`${prefix}.`));

/** Функции платформы вне Реестра — закреплены за ролью */
const INHERENT: Record<Role, string[]> = {
  SUPERADMIN: ['schedule.view', 'webinars.view'],
  ORGANIZATION_ADMIN: ['schedule.view', 'webinars.view', 'organization.manage'],
  TRAINER: ['schedule.view', 'webinars.view'],
  LEARNER: ['schedule.view', 'webinars.view'],
  CUSTOM: ['schedule.view', 'webinars.view'],
};

/**
 * Права роли для разделов кабинета, выведенные из матрицы:
 * курсы — просмотр/создание, пользователи, отчёты; плюс функции вне Реестра.
 */
export function derivePermissions(role: Role, matrix: readonly string[]): string[] {
  const p = new Set(INHERENT[role]);
  const courseView = [
    'lms_prog_core.view',
    'lms_prog_core.list_view',
    'lms_learner_cabinet.my_courses',
    'lms_trainer_cabinet.my_courses',
  ].some((k) => has(matrix, k)) || matrix.some((k) => /^lms_element_[a-z_]+\.view$/.test(k));
  if (courseView) p.add('courses.view');
  if (has(matrix, 'lms_prog_core.create')) p.add('courses.manage');
  if (has(matrix, 'lms_users.list_view')) p.add('users.manage');
  if (has(matrix, 'lms_report_builder')) p.add('reports.view');
  if (has(matrix, 'lms_chat.view')) p.add('chat.view');
  if (has(matrix, 'lms_certificates.view')) p.add('certificates.view');
  return [...p];
}

/** Действие с элементом контента разрешено итоговым доступом */
export const canElement = (access: readonly string[], type: string, action: 'create' | 'edit' | 'delete' | 'view') =>
  access.includes(`${elementModuleKey(type)}.${action}`);
