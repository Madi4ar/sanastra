/**
 * Реестр модулей для мок-бэкенда: справочник программных блоков, поставляемых разработкой.
 * Модули публикуются через CI/CD или системный API; суперадминистратор может только
 * переименовывать отображаемые названия. Удаление и выключение элементов отсутствуют.
 */
import dayjs from 'dayjs';
import type { RegistryModule, RegistryOption, RegistryPublishOption, RegistryPublishPayload } from '@/api/types';

const STORAGE_KEY = 'superadmin-mock-registry-v1';

/** Элемент начального наполнения: [сегмент ключа, системное название, коммерческое название, вложенные опции] */
type SeedOption = [string, string, string, SeedOption[]?];

/** Перечень модулей и опций первой очереди (раздел 4 ТЗ). «Элементы контента (Конструктор курсов)» — в следующей очереди. */
const SEED: { key: string; displayName: string | null; versions: string[]; options: SeedOption[] }[] = [
  {
    // Пример из ТЗ: кодовое имя ещё не переименовано суперадминистратором
    key: 'lms_prog_core',
    displayName: null,
    versions: ['1.0.0', '1.1.0', '1.2.0'],
    options: [
      ['create', 'create', 'Создание'],
      ['edit', 'edit', 'Редактирование'],
      ['delete', 'delete', 'Удаление'],
      ['view', 'view', 'Просмотр'],
    ],
  },
  {
    key: 'lms_roles',
    displayName: 'Управление ролями',
    versions: ['1.0.0', '1.0.1'],
    options: [
      ['create', 'create', 'Создание'],
      ['edit', 'edit', 'Редактирование'],
      ['delete', 'delete', 'Удаление'],
      ['view', 'view', 'Просмотр'],
      ['assign_privileges', 'assign_privileges', 'Присвоение привилегий к созданным ролям'],
    ],
  },
  {
    key: 'lms_users',
    displayName: 'Управление пользователями',
    versions: ['1.0.0', '1.1.0'],
    options: [
      ['create', 'create', 'Создание'],
      ['edit', 'edit', 'Редактирование данных пользователей'],
      ['list_view', 'list_view', 'Просмотр списка пользователей'],
      ['assign_roles', 'assign_roles', 'Присвоение ролей к пользователям'],
      ['deactivate', 'deactivate', 'Деактивация пользователя'],
    ],
  },
  {
    key: 'lms_departments',
    displayName: 'Управление отделами',
    versions: ['1.0.0'],
    options: [
      ['create_structure', 'create_structure', 'Создание структуры компании'],
      ['edit', 'edit', 'Редактирование'],
      ['delete', 'delete', 'Удаление'],
      ['view', 'view', 'Просмотр'],
      ['bind_users', 'bind_users', 'Привязка пользователей к этим отделам'],
    ],
  },
  {
    key: 'lms_groups',
    displayName: 'Управление учебными группами',
    versions: ['1.0.0', '1.0.1'],
    options: [
      ['create', 'create', 'Создание'],
      ['edit', 'edit', 'Редактирование'],
      ['delete', 'delete', 'Удаление'],
      ['view', 'view', 'Просмотр'],
      ['add_members_manual', 'add_members_manual', 'Добавление людей вручную в группу по ИИН / почте / ФИО'],
    ],
  },
  {
    key: 'lms_report_builder',
    displayName: 'Управление конструктора отчетов',
    versions: ['0.9.0', '1.0.0'],
    options: [['builder_basic', 'builder_basic', 'Конструктор отчетов (базовый функционал генерации)']],
  },
  {
    key: 'lms_learner_cabinet',
    displayName: 'ЛК Слушателя',
    versions: ['1.0.0'],
    options: [
      [
        'profile',
        'profile',
        'Профиль',
        [
          ['edit', 'edit', 'Изменение'],
          ['view', 'view', 'Просмотр'],
        ],
      ],
      ['my_courses', 'my_courses', 'Мои курсы', [['take_course', 'take_course', 'Прохождение курса']]],
    ],
  },
  {
    key: 'lms_trainer_cabinet',
    displayName: 'ЛК Тренера',
    versions: ['1.0.0', '1.0.2'],
    options: [
      [
        'profile',
        'profile',
        'Профиль',
        [
          ['edit', 'edit', 'Изменение'],
          ['view', 'view', 'Просмотр'],
        ],
      ],
      [
        'my_courses',
        'my_courses',
        'Мои курсы',
        [
          ['view', 'view', 'Просмотр'],
          ['review_assignments', 'review_assignments', 'Проверка заданий'],
          ['download_report', 'download_report', 'Скачивание отчета'],
        ],
      ],
    ],
  },
  {
    key: 'lms_course_showcase',
    displayName: 'Витрина курсов',
    versions: ['1.0.0'],
    options: [
      ['catalog_view', 'catalog_view', 'Просмотр каталога'],
      ['submit_application', 'submit_application', 'Оставление заявки к курсу/группе'],
    ],
  },
];

function seedOption(parent: string, [key, systemName, displayName, children]: SeedOption): RegistryOption {
  const full = `${parent}.${key}`;
  return {
    key: full,
    systemName,
    displayName,
    ...(children?.length ? { options: children.map((c) => seedOption(full, c)) } : {}),
  };
}

function seed(): RegistryModule[] {
  return SEED.map((m, i) => {
    const versions = m.versions
      .map((version, j) => ({
        version,
        publishedAt: dayjs()
          .subtract(120 - j * 25 - i, 'day')
          .hour(10 + (i % 6))
          .minute(0)
          .second(0)
          .millisecond(0)
          .toISOString(),
        publishedBy: 'CI_CD' as const,
      }))
      .reverse();
    const current = versions[0]!;
    return {
      key: m.key,
      systemName: m.key,
      displayName: m.displayName,
      version: current.version,
      updatedAt: current.publishedAt,
      versions,
      options: m.options.map((o) => seedOption(m.key, o)),
    };
  });
}

let memory: RegistryModule[] | null = null;

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadRegistry(): RegistryModule[] {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (raw) {
      memory = JSON.parse(raw) as RegistryModule[];
      return memory;
    }
  } catch {
    /* повреждённые данные — пересоздаём */
  }
  if (!memory) memory = seed();
  return memory;
}

function saveRegistry(modules: RegistryModule[]) {
  memory = modules;
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(modules));
  } catch {
    /* остаёмся в памяти */
  }
}

export function resetRegistry() {
  memory = seed();
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

const KEY_SEGMENT = /^[a-z][a-z0-9_]{0,63}$/;
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

function findNode(modules: RegistryModule[], key: string): RegistryModule | RegistryOption | undefined {
  const walk = (nodes: RegistryOption[] | undefined): RegistryOption | undefined => {
    for (const n of nodes ?? []) {
      if (n.key === key) return n;
      const found = walk(n.options);
      if (found) return found;
    }
    return undefined;
  };
  for (const m of modules) {
    if (m.key === key) return m;
    if (key.startsWith(`${m.key}.`)) return walk(m.options);
  }
  return undefined;
}

/** Переименование модуля или опции. Пустое название возвращает системное. */
export function renameNode(key: string, displayName: string | null): RegistryModule | null {
  const modules = loadRegistry();
  const node = findNode(modules, key);
  if (!node) return null;
  node.displayName = displayName;
  saveRegistry(modules);
  return modules.find((m) => key === m.key || key.startsWith(`${m.key}.`)) ?? null;
}

/** Ошибки полезной нагрузки публикации: путь поля → сообщение */
export function validatePublish(body: Partial<RegistryPublishPayload>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (typeof body.key !== 'string' || !KEY_SEGMENT.test(body.key)) errors.key = 'Ключ: латиница в нижнем регистре, цифры и «_»';
  if (typeof body.systemName !== 'string' || !body.systemName.trim()) errors.systemName = 'Укажите системное название';
  if (typeof body.version !== 'string' || !SEMVER.test(body.version)) errors.version = 'Версия в формате MAJOR.MINOR.PATCH';
  const walk = (opts: unknown, path: string) => {
    if (!Array.isArray(opts)) {
      errors[path] = 'Перечень опций должен быть массивом';
      return;
    }
    const seen = new Set<string>();
    (opts as Partial<RegistryPublishOption>[]).forEach((o, i) => {
      const p = `${path}[${i}]`;
      if (typeof o?.key !== 'string' || !KEY_SEGMENT.test(o.key)) errors[`${p}.key`] = 'Некорректный ключ опции';
      else if (seen.has(o.key)) errors[`${p}.key`] = `Ключ «${o.key}» повторяется`;
      else seen.add(o.key);
      if (typeof o?.systemName !== 'string' || !o.systemName.trim()) errors[`${p}.systemName`] = 'Укажите системное название опции';
      if (o?.options !== undefined) walk(o.options, `${p}.options`);
    });
  };
  walk(body.options, 'options');
  return errors;
}

/** Собирает дерево опций из публикации, сохраняя коммерческие названия существующих ключей */
function buildOptions(parent: string, opts: RegistryPublishOption[], names: Map<string, string | null>): RegistryOption[] {
  return opts.map((o) => {
    const key = `${parent}.${o.key}`;
    return {
      key,
      systemName: o.systemName.trim(),
      displayName: names.get(key) ?? null,
      ...(o.options?.length ? { options: buildOptions(key, o.options, names) } : {}),
    };
  });
}

function collectNames(nodes: RegistryOption[] | undefined, into: Map<string, string | null>) {
  for (const n of nodes ?? []) {
    into.set(n.key, n.displayName);
    collectNames(n.options, into);
  }
}

export type PublishResult = { module: RegistryModule; created: boolean } | { conflict: string };

/**
 * Публикация или обновление модуля разработкой. Перечень опций заменяется целиком
 * (реестр отражает фактический код), коммерческие названия сохраняются по ключам.
 * Понижение версии запрещено; повторная публикация той же версии обновляет опции.
 */
export function publishModule(body: RegistryPublishPayload, source: 'CI_CD' | 'SYSTEM_API'): PublishResult {
  const modules = loadRegistry();
  const existing = modules.find((m) => m.key === body.key);
  const now = dayjs().toISOString();
  if (existing && compareVersions(body.version, existing.version) < 0) {
    return { conflict: `Версия ${body.version} ниже текущей ${existing.version}` };
  }
  const names = new Map<string, string | null>();
  collectNames(existing?.options, names);
  const options = buildOptions(body.key, body.options, names);

  if (!existing) {
    const module: RegistryModule = {
      key: body.key,
      systemName: body.systemName.trim(),
      displayName: null,
      version: body.version,
      updatedAt: now,
      versions: [{ version: body.version, publishedAt: now, publishedBy: source }],
      options,
    };
    modules.push(module);
    saveRegistry(modules);
    return { module, created: true };
  }

  existing.systemName = body.systemName.trim();
  existing.options = options;
  existing.updatedAt = now;
  if (body.version !== existing.version) {
    existing.version = body.version;
    existing.versions.unshift({ version: body.version, publishedAt: now, publishedBy: source });
  } else {
    existing.versions[0] = { version: existing.version, publishedAt: now, publishedBy: source };
  }
  saveRegistry(modules);
  return { module: existing, created: false };
}
