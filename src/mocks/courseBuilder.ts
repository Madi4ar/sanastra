/**
 * Содержимое курсов для мок-бэкенда: модули → дни → элементы контента.
 * Хранится отдельно от карточек курсов; создаётся при первом открытии конструктора.
 */
import type { CourseDay, CourseElement, CourseModule, ElementPayload, ElementType, StructureMove } from '@/api/types';
import {
  blankBlock,
  blankEvent,
  blankQuestion,
  defaultSettings,
  ELEMENT_TYPES,
  uid,
  validateElement,
} from '@/features/course-builder/elementTypes';

const STORAGE_KEY = 'superadmin-mock-course-content-v1';

type Store = Record<string, CourseModule[]>;
let memory: Store = {};

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function loadAll(): Store {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (raw) memory = JSON.parse(raw) as Store;
  } catch {
    /* повреждённые данные — пересоздаются */
  }
  return memory;
}

function saveAll(all: Store) {
  memory = all;
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* квота — остаёмся в памяти */
  }
}

export function resetCourseContent() {
  memory = {};
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function removeCourseContent(courseId: string) {
  const all = loadAll();
  delete all[courseId];
  saveAll(all);
}

export function removeCourseContentOf(courseIdPrefix: string) {
  const all = loadAll();
  for (const id of Object.keys(all)) if (id.startsWith(courseIdPrefix)) delete all[id];
  saveAll(all);
}

function element<T extends ElementType>(type: T, titleRu: string, titleKz: string, patch?: (s: ReturnType<typeof defaultSettings<T>>) => void): CourseElement {
  const settings = defaultSettings(type);
  patch?.(settings);
  return {
    id: uid('el'),
    type,
    titleRu,
    titleKz,
    required: !['link', 'survey', 'reflection'].includes(type),
    hidden: false,
    settings: settings as unknown as Record<string, unknown>,
    files: [],
    updatedAt: new Date().toISOString(),
  };
}

/** Первый курс организации получает демонстрационное наполнение, остальные — пустой модуль и день */
function seed(courseId: string): CourseModule[] {
  const demo = /-c1$/.test(courseId);
  if (!demo) return [{ id: uid('m'), title: 'Модуль 1', days: [{ id: uid('d'), title: 'День 1', elements: [] }] }];

  const intro = element('text', 'Введение в курс', 'Курсқа кіріспе', (s) => {
    const h = blankBlock('heading');
    h.text_ru = 'О чём этот курс';
    h.text_kz = 'Бұл курс не туралы';
    const p = blankBlock('paragraph');
    p.text_ru = 'Курс состоит из модулей и учебных дней. Обязательные элементы нужны для завершения курса.';
    p.text_kz = 'Курс модульдер мен оқу күндерінен тұрады. Міндетті элементтер курсты аяқтау үшін қажет.';
    const c = blankBlock('callout');
    c.tone = 'tip';
    c.title_ru = 'Совет';
    c.text_ru = 'Проходите элементы по порядку — так материал усваивается лучше.';
    s.blocks = [h, p, c];
    s.read_min_ru = 5;
    s.read_min_kz = 5;
  });
  const video = element('video', 'Видеолекция: основные понятия', 'Бейнедәріс: негізгі ұғымдар', (s) => {
    s.url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    s.duration_min = 12;
  });
  const ivideo = element('interactive_video', 'Разбор задачи с вопросами', 'Сұрақтары бар есепті талдау', (s) => {
    s.url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    s.duration_min = 8;
    const ev = blankEvent(95);
    ev.text_ru = 'Какой шаг решения был следующим?';
    ev.options[0]!.ru = 'Перенести слагаемые';
    ev.options[1]!.ru = 'Разделить обе части';
    s.events = [ev, { ...blankEvent(240, 'chapter'), title_ru: 'Проверка ответа' }];
  });
  const test = element('test', 'Тест по модулю 1', '1-модуль бойынша тест', (s) => {
    const q1 = blankQuestion('single');
    q1.text_ru = 'Сколько будет 2 + 2 × 2?';
    q1.options[0]!.ru = '6';
    q1.options[1]!.ru = '8';
    q1.options[2]!.ru = '4';
    const q2 = blankQuestion('short');
    q2.text_ru = 'Как называется результат сложения?';
    q2.short_answers = 'сумма';
    s.questions = [q1, q2];
  });
  const work = element('assignment', 'Практическая работа № 1', '№ 1 практикалық жұмыс', (s) => {
    s.task_ru = 'Решите задачи из приложенного файла и загрузите решение.';
    s.criteria_ru = 'Верное решение — 2 балла за задачу, оформление — 2 балла.';
  });
  const link = element('link', 'Дополнительные материалы', 'Қосымша материалдар', (s) => {
    s.url = 'https://ru.wikipedia.org/wiki/Алгебра';
  });
  const reflection = element('reflection', 'Что было самым сложным?', 'Ең қиыны не болды?', (s) => {
    s.question_ru = 'Что в этом дне было самым сложным и почему?';
    s.question_kz = 'Бұл күні ең қиыны не болды және неге?';
  });
  return [
    {
      id: uid('m'),
      title: 'Модуль 1. Основы',
      days: [
        { id: uid('d'), title: 'День 1. Знакомство', elements: [intro, video, ivideo] },
        { id: uid('d'), title: 'День 2. Практика', elements: [work, test, link, reflection] },
      ],
    },
    { id: uid('m'), title: 'Модуль 2. Углубление', days: [{ id: uid('d'), title: 'День 1', elements: [] }] },
  ];
}

export function getStructure(courseId: string): CourseModule[] {
  const all = loadAll();
  if (!all[courseId]) {
    all[courseId] = seed(courseId);
    saveAll(all);
  }
  return all[courseId]!;
}

export const countElements = (modules: CourseModule[]) =>
  modules.reduce((n, m) => n + m.days.reduce((k, d) => k + d.elements.length, 0), 0);

/** Изменение структуры курса; возвращает результат колбэка или ошибку */
export function mutate<T>(courseId: string, fn: (modules: CourseModule[]) => T): T {
  const all = loadAll();
  const modules = all[courseId] ?? seed(courseId);
  const result = fn(modules);
  all[courseId] = modules;
  saveAll(all);
  return result;
}

export function findDay(modules: CourseModule[], dayId: string): CourseDay | undefined {
  for (const m of modules) {
    const d = m.days.find((x) => x.id === dayId);
    if (d) return d;
  }
  return undefined;
}

export function findElement(modules: CourseModule[], id: string): { day: CourseDay; element: CourseElement } | undefined {
  for (const m of modules)
    for (const d of m.days) {
      const element = d.elements.find((e) => e.id === id);
      if (element) return { day: d, element };
    }
  return undefined;
}

export function move<T extends { id: string }>(list: T[], id: string, direction: StructureMove): boolean {
  const i = list.findIndex((x) => x.id === id);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j]!, list[i]!];
  return true;
}

export function newElement(type: ElementType, titleRu: string, titleKz: string): CourseElement | null {
  if (!ELEMENT_TYPES.includes(type)) return null;
  return element(type, titleRu, titleKz);
}

/** Проверка и применение изменений элемента. Возвращает ошибки полей или null. */
export function applyElement(el: CourseElement, body: Partial<ElementPayload>): Record<string, string> | null {
  const defaults = defaultSettings(el.type) as unknown as Record<string, unknown>;
  const raw = (body.settings ?? {}) as Record<string, unknown>;
  // Только известные типу ключи — лишние данные в settings не попадают (ElementSettings::clean)
  const settings = Object.fromEntries(Object.keys(defaults).map((k) => [k, k in raw ? raw[k] : defaults[k]]));
  const next = {
    type: el.type,
    titleRu: typeof body.titleRu === 'string' ? body.titleRu : '',
    titleKz: typeof body.titleKz === 'string' ? body.titleKz : '',
    settings,
    files: Array.isArray(body.files) ? body.files : [],
  };
  const errors = validateElement(next);
  if (Object.keys(errors).length) return errors;
  el.titleRu = next.titleRu.trim();
  el.titleKz = next.titleKz.trim();
  el.required = Boolean(body.required);
  el.hidden = Boolean(body.hidden);
  el.settings = settings;
  el.files = next.files;
  el.updatedAt = new Date().toISOString();
  return null;
}
