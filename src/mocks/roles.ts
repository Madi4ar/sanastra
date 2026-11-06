/**
 * Глобальные роли платформы для мок-бэкенда: предопределённые системные (is_system) и кастомные,
 * у каждой — матрица доступов из опций Реестра модулей.
 */
import type { GlobalRole, SystemRole } from '@/api/types';
import { allLeafKeys } from '@/shared/access';
import { loadRegistry } from './registry';

export type GlobalRoleRecord = Omit<GlobalRole, 'usersCount'>;

const STORAGE_KEY = 'superadmin-mock-roles-v3';

export const SYSTEM_ROLE_CODE: Record<SystemRole, string> = {
  SUPERADMIN: 'superadmin',
  ORGANIZATION_ADMIN: 'organization_admin',
  TRAINER: 'trainer',
  LEARNER: 'learner',
};

/** Опции, ключ которых начинается с одного из префиксов */
function pick(all: string[], prefixes: string[]): string[] {
  return all.filter((k) => prefixes.some((p) => k === p || k.startsWith(`${p}.`)));
}

function seed(): GlobalRoleRecord[] {
  const all = allLeafKeys(loadRegistry());
  const elements = all.filter((k) => k.startsWith('lms_element_'));
  const contentView = elements.filter((k) => k.endsWith('.view'));
  const at = new Date().toISOString();
  const system = (systemRole: SystemRole, name: string, description: string, matrix: string[]): GlobalRoleRecord => ({
    id: `role-${SYSTEM_ROLE_CODE[systemRole]}`,
    code: SYSTEM_ROLE_CODE[systemRole],
    name,
    description,
    isSystem: true,
    systemRole,
    matrix,
    updatedAt: at,
  });
  return [
    system('SUPERADMIN', 'Суперадминистратор', 'Управление платформой: организации, тарифы, роли, реестр модулей', all),
    system('ORGANIZATION_ADMIN', 'Администратор организации', 'Полное управление кабинетом своей организации', all),
    // Пример из ТЗ: учебные программы — только просмотр, ЛК Тренера — все опции
    system('TRAINER', 'Тренер', 'Ведёт курсы и группы, проверяет задания', [
      ...pick(all, ['lms_prog_core.view', 'lms_trainer_cabinet', 'lms_groups.view', 'lms_report_builder', 'lms_chat', 'lms_certificates']),
      ...elements,
      ...pick(all, ['lms_course_showcase.catalog_view']),
    ]),
    system('LEARNER', 'Слушатель', 'Проходит курсы, оставляет заявки на витрине', [
      ...pick(all, ['lms_learner_cabinet', 'lms_course_showcase', 'lms_chat', 'lms_certificates.view']),
      ...contentView,
    ]),
    {
      id: 'role-senior_methodist',
      code: 'senior_methodist',
      name: 'Старший методист',
      description: 'Разрабатывает учебные программы и контент курсов',
      isSystem: false,
      matrix: [
        ...pick(all, ['lms_prog_core', 'lms_groups', 'lms_report_builder', 'lms_users', 'lms_departments', 'lms_course_showcase', 'lms_trainer_cabinet', 'lms_chat', 'lms_certificates']),
        ...elements,
      ],
      updatedAt: at,
    },
    {
      id: 'role-group_curator',
      code: 'group_curator',
      name: 'Куратор группы',
      description: 'Сопровождает учебные группы',
      isSystem: false,
      matrix: pick(all, ['lms_groups', 'lms_users.list_view', 'lms_chat']),
      updatedAt: at,
    },
  ];
}

let memory: GlobalRoleRecord[] | null = null;

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadRoles(): GlobalRoleRecord[] {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (raw) {
      memory = JSON.parse(raw) as GlobalRoleRecord[];
      return memory;
    }
  } catch {
    /* повреждённые данные — пересоздаём */
  }
  if (!memory) memory = seed();
  return memory;
}

export function saveRoles(roles: GlobalRoleRecord[]) {
  memory = roles;
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(roles));
  } catch {
    /* остаёмся в памяти */
  }
}

export function resetRoles() {
  memory = seed();
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Матрица роли назначения: системной — по роли платформы, кастомной — по коду */
export function matrixOf(role: string, customRole?: string): string[] {
  const roles = loadRoles();
  const found =
    role === 'CUSTOM' ? roles.find((r) => !r.isSystem && r.code === customRole) : roles.find((r) => r.systemRole === role);
  return found?.matrix ?? [];
}

export const findCustomRole = (code: string | undefined) => loadRoles().find((r) => !r.isSystem && r.code === code);
