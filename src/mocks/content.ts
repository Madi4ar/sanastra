/**
 * Контент модулей организации (курсы, вебинары) для мок-бэкенда.
 * Хранится отдельно от конфигурации tenant; создаётся при первом обращении.
 * Количество курсов синхронизировано с usage.COURSES_COUNT (лимит считает сервер).
 */
import dayjs from 'dayjs';
import type { Course, Webinar, WebinarStatus } from '@/api/types';
import type { OrgRecord } from './db';

interface StoredWebinar extends Omit<Webinar, 'status' | 'registeredByMe' | 'registered'> {
  baseRegistered: number;
  registeredUserIds: string[];
}

interface TenantContent {
  courses: Course[];
  webinars: StoredWebinar[];
}

const STORAGE_KEY = 'superadmin-mock-content-v1';

const COURSE_TEMPLATES: Omit<Course, 'id' | 'updatedAt'>[] = [
  { title: 'Алгебра: подготовка к ЕНТ', category: 'Математика', teacher: 'Ирина Петрова', lessonsCount: 24, studentsCount: 48, progress: 72, status: 'PUBLISHED' },
  { title: 'Геометрия 8 класс', category: 'Математика', teacher: 'Ирина Петрова', lessonsCount: 18, studentsCount: 31, progress: 55, status: 'PUBLISHED' },
  { title: 'Английский язык B1', category: 'Языки', teacher: 'Сабина Алиева', lessonsCount: 32, studentsCount: 62, progress: 64, status: 'PUBLISHED' },
  { title: 'Казахский язык для начинающих', category: 'Языки', teacher: 'Айгерим Касымова', lessonsCount: 20, studentsCount: 27, progress: 41, status: 'PUBLISHED' },
  { title: 'Физика: механика', category: 'Естественные науки', teacher: 'Олжас Нуриев', lessonsCount: 16, studentsCount: 22, progress: 38, status: 'PUBLISHED' },
  { title: 'Химия: органика с нуля', category: 'Естественные науки', teacher: 'Мадина Ержанова', lessonsCount: 14, studentsCount: 19, progress: 27, status: 'PUBLISHED' },
  { title: 'Основы Python', category: 'Информатика', teacher: 'Тимур Бекенов', lessonsCount: 28, studentsCount: 54, progress: 69, status: 'PUBLISHED' },
  { title: 'Веб-разработка: HTML и CSS', category: 'Информатика', teacher: 'Тимур Бекенов', lessonsCount: 22, studentsCount: 36, progress: 58, status: 'PUBLISHED' },
  { title: 'История Казахстана', category: 'Гуманитарные науки', teacher: 'Ерлан Жумабаев', lessonsCount: 15, studentsCount: 0, progress: 0, status: 'DRAFT' },
  { title: 'Биология: клетка и генетика', category: 'Естественные науки', teacher: 'Мадина Ержанова', lessonsCount: 12, studentsCount: 0, progress: 0, status: 'DRAFT' },
  { title: 'Олимпиадная математика', category: 'Математика', teacher: 'Ирина Петрова', lessonsCount: 10, studentsCount: 12, progress: 22, status: 'PUBLISHED' },
  { title: 'Академическое письмо', category: 'Языки', teacher: 'Сабина Алиева', lessonsCount: 8, studentsCount: 0, progress: 0, status: 'DRAFT' },
];

export const COURSE_CATEGORIES = [...new Set(COURSE_TEMPLATES.map((c) => c.category))];

/** Смещения относительно момента создания: [минуты от «сейчас», длительность] */
const WEBINAR_TEMPLATES: { title: string; speaker: string; offsetMin: number; durationMin: number; base: number; capacity: number }[] = [
  { title: 'Как готовиться к ЕНТ по математике', speaker: 'Ирина Петрова', offsetMin: -15, durationMin: 90, base: 112, capacity: 200 },
  { title: 'Разговорный клуб: путешествия', speaker: 'Сабина Алиева', offsetMin: 60 * 26, durationMin: 60, base: 34, capacity: 50 },
  { title: 'Python для школьников: первый проект', speaker: 'Тимур Бекенов', offsetMin: 60 * 24 * 3 + 120, durationMin: 75, base: 58, capacity: 100 },
  { title: 'Родительское собрание: итоги четверти', speaker: 'Алия Сапарова', offsetMin: 60 * 24 * 6, durationMin: 45, base: 87, capacity: 150 },
  { title: 'Физика в задачах: кинематика', speaker: 'Олжас Нуриев', offsetMin: -60 * 24 * 2, durationMin: 60, base: 76, capacity: 100 },
  { title: 'Тайм-менеджмент для учеников', speaker: 'Айгерим Касымова', offsetMin: -60 * 24 * 7, durationMin: 50, base: 140, capacity: 200 },
  { title: 'Олимпиадная математика: разбор задач', speaker: 'Ирина Петрова', offsetMin: -60 * 24 * 12, durationMin: 80, base: 63, capacity: 80 },
];

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

let memory: Record<string, TenantContent> = {};

function loadAll(): Record<string, TenantContent> {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (raw) memory = JSON.parse(raw) as Record<string, TenantContent>;
  } catch {
    /* повреждённые данные — пересоздаются */
  }
  return memory;
}

function saveAll(all: Record<string, TenantContent>) {
  memory = all;
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* остаёмся в памяти */
  }
}

/** Удаление контента организации вместе с ней */
export function removeContent(tenantId: string) {
  const all = loadAll();
  delete all[tenantId];
  saveAll(all);
}

export function resetContent() {
  memory = {};
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Ровное время начала: идущий эфир — до 5 минут вниз, остальные — до часа. */
function roundStart(d: dayjs.Dayjs, live: boolean) {
  const base = d.second(0).millisecond(0);
  return live ? base.minute(Math.floor(base.minute() / 5) * 5) : base.minute(0);
}

function seed(org: OrgRecord): TenantContent {
  const now = dayjs();
  const count = Math.max(0, Math.round(org.usage.COURSES_COUNT ?? 0));
  const courses: Course[] = Array.from({ length: count }, (_, i) => {
    const t = COURSE_TEMPLATES[i % COURSE_TEMPLATES.length]!;
    return {
      ...t,
      id: `${org.tenantId}-c${i + 1}`,
      title: i < COURSE_TEMPLATES.length ? t.title : `${t.title} (поток ${Math.floor(i / COURSE_TEMPLATES.length) + 1})`,
      updatedAt: now.subtract(i * 3 + 1, 'day').toISOString(),
    };
  });
  const webinars: StoredWebinar[] = WEBINAR_TEMPLATES.map((w, i) => ({
    id: `${org.tenantId}-w${i + 1}`,
    title: w.title,
    speaker: w.speaker,
    startsAt: roundStart(now.add(w.offsetMin, 'minute'), w.offsetMin < 0 && -w.offsetMin < w.durationMin).toISOString(),
    durationMin: w.durationMin,
    capacity: w.capacity,
    baseRegistered: w.base,
    registeredUserIds: [],
  }));
  return { courses, webinars };
}

function contentFor(org: OrgRecord): { all: Record<string, TenantContent>; content: TenantContent } {
  const all = loadAll();
  let content = all[org.tenantId];
  if (!content) {
    content = seed(org);
    all[org.tenantId] = content;
    saveAll(all);
  }
  return { all, content };
}

export function webinarStatus(w: Pick<Webinar, 'startsAt' | 'durationMin'>, now = dayjs()): WebinarStatus {
  const start = dayjs(w.startsAt);
  if (now.isBefore(start)) return 'UPCOMING';
  if (now.isBefore(start.add(w.durationMin, 'minute'))) return 'LIVE';
  return 'RECORDED';
}

export function listCourses(org: OrgRecord): Course[] {
  return [...contentFor(org).content.courses].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function listWebinars(org: OrgRecord, userId: string): Webinar[] {
  return contentFor(org)
    .content.webinars.map((w) => {
      const { baseRegistered, registeredUserIds, ...rest } = w;
      return {
        ...rest,
        status: webinarStatus(w),
        registered: baseRegistered + registeredUserIds.length,
        registeredByMe: registeredUserIds.includes(userId),
      };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function addCourse(org: OrgRecord, input: { title: string; category: string; teacher: string }): Course {
  const { all, content } = contentFor(org);
  const course: Course = {
    id: `${org.tenantId}-c${Date.now()}`,
    title: input.title,
    category: input.category,
    teacher: input.teacher,
    lessonsCount: 0,
    studentsCount: 0,
    progress: 0,
    status: 'DRAFT',
    updatedAt: new Date().toISOString(),
  };
  content.courses.push(course);
  saveAll(all);
  return course;
}

export function courseCount(org: OrgRecord): number {
  return contentFor(org).content.courses.length;
}

/** Запись на вебинар / отмена записи. Возвращает null, если вебинар не найден или запись закрыта. */
export function toggleWebinarRegistration(org: OrgRecord, webinarId: string, userId: string): boolean | null {
  const { all, content } = contentFor(org);
  const w = content.webinars.find((x) => x.id === webinarId);
  if (!w || webinarStatus(w) === 'RECORDED') return null;
  const registered = w.registeredUserIds.includes(userId);
  if (!registered && w.baseRegistered + w.registeredUserIds.length >= w.capacity) return null;
  w.registeredUserIds = registered ? w.registeredUserIds.filter((id) => id !== userId) : [...w.registeredUserIds, userId];
  saveAll(all);
  return !registered;
}
