/**
 * Мок-бэкенд конструктора полей профиля, анкет и прогресса обучения.
 * Используется только обработчиками MSW: страницы получают эти данные через API.
 */
import type {
  CourseElement,
  ElementProgress,
  ProfileFieldDefinition,
  ProfileFieldOption,
  ProfileFieldScheme,
  ProfileFieldSchemeRow,
  ProfileFieldType,
  ProfileFormField,
  TestAnswers,
  TestResult,
} from '@/api/types';
import type { TestQuestion, TestSettings } from '@/features/course-builder/elementTypes';

/** Поле, значение которого берётся из учётной записи пользователя */
export type AccountSource = 'iin' | 'fullName' | 'email' | 'phone' | 'region';

export interface FieldRecord {
  id: string;
  tenantId: string | null;
  system: boolean;
  active: boolean;
  labelKz: string;
  labelRu: string;
  labelEn: string;
  type: ProfileFieldType;
  directoryId: string | null;
  source?: AccountSource;
  /** Только для глобальных полей: вывод в анкете тренера во всех организациях */
  inTrainerProfile?: boolean;
  trainerRequired?: boolean;
}

/** Справочник вариантов поля. tenantId = null — глобальный справочник суперадминистратора. */
export interface FieldDirectoryRecord {
  id: string;
  tenantId: string | null;
  items: ProfileFieldOption[];
}

export interface SchemeRecord {
  id: string;
  tenantId: string;
  name: string;
  fields: ProfileFieldSchemeRow[];
  isDefault: boolean;
}

/** Состояние элемента курса у слушателя в конкретной группе */
export interface ElementState {
  viewed?: boolean;
  testStarted?: boolean;
  testAttempts?: number;
  test?: { score: number; maxScore: number; percent: number; passed: boolean };
  work?: { answer: string; done: boolean; score: number | null };
}

/** Прогресс привязан к группе: повторное обучение в другой группе начинается с нуля */
export interface ProgressRecord {
  groupId: string;
  userId: string;
  elements: Record<string, ElementState>;
}

interface Store {
  globals: FieldRecord[];
  directories: FieldDirectoryRecord[];
  /** Глобальные поля, включённые организацией; нет записи — включены все активные */
  tenantActive: Record<string, string[]>;
  custom: FieldRecord[];
  schemes: SchemeRecord[];
  trainerSchemeByTenant: Record<string, string>;
  /** Значения анкеты: `${tenantId}:${userId}` → поле → значение */
  values: Record<string, Record<string, string>>;
  progress: ProgressRecord[];
  /** `${groupId}:${dayId}:${memberId}` → присутствовал */
  attendance: Record<string, boolean>;
}

const KEY = 'superadmin-mock-profile-fields-v4';

const GLOBAL_FIELDS: [string, string, string, AccountSource?][] = [
  ['ЖСН', 'ИИН', 'IIN', 'iin'],
  ['Аты-жөні', 'ФИО', 'Full name', 'fullName'],
  ['Email', 'Email', 'Email', 'email'],
  ['Телефон', 'Телефон', 'Phone', 'phone'],
  ['Жынысы', 'Пол', 'Gender'],
  ['Ұлты', 'Национальность', 'Nationality'],
  ['Облыс', 'Область', 'Region', 'region'],
  ['Аудан', 'Район', 'District'],
  ['Лауазымы', 'Должность', 'Position'],
  ['Білімі', 'Образование', 'Education'],
  ['Ғылыми деңгейі', 'Научный уровень', 'Academic degree'],
  ['Санаты', 'Категория', 'Category'],
  ['Білім беру ұйымы', 'Организация образования', 'Educational institution'],
];

const GENDER_DIRECTORY = 'global-directory-gender';

const initial = (): Store => ({
  globals: GLOBAL_FIELDS.map(([labelKz, labelRu, labelEn, source], i) => ({
    id: `global-${i + 1}`,
    tenantId: null,
    system: true,
    active: true,
    labelKz,
    labelRu,
    labelEn,
    type: labelRu === 'Пол' ? 'DROPDOWN' : 'TEXT',
    directoryId: labelRu === 'Пол' ? GENDER_DIRECTORY : null,
    ...(source ? { source } : {}),
    inTrainerProfile: false,
    trainerRequired: false,
  })),
  directories: [
    {
      id: GENDER_DIRECTORY,
      tenantId: null,
      items: [
        { id: 'gender-m', labelKz: 'Ер', labelRu: 'Мужской', labelEn: 'Male' },
        { id: 'gender-f', labelKz: 'Әйел', labelRu: 'Женский', labelEn: 'Female' },
      ],
    },
  ],
  tenantActive: {},
  custom: [],
  schemes: [],
  trainerSchemeByTenant: {},
  values: {},
  progress: [],
  attendance: {},
});

let memory: Store | null = null;
const storage = () => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

export function loadProfileFields(): Store {
  if (memory) return memory;
  try {
    const raw = storage()?.getItem(KEY);
    if (raw) return (memory = JSON.parse(raw) as Store);
  } catch {
    /* пересоздать */
  }
  return (memory = initial());
}

export function saveProfileFields(store: Store) {
  memory = store;
  try {
    storage()?.setItem(KEY, JSON.stringify(store));
  } catch {
    /* хранилище недоступно: данные остаются в памяти */
  }
}

export function resetProfileFields() {
  memory = null;
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// ---------- Поля и справочники ----------

export const directoryItems = (store: Store, directoryId: string | null) =>
  store.directories.find((d) => d.id === directoryId)?.items ?? [];

export function toDefinition(store: Store, field: FieldRecord): ProfileFieldDefinition {
  return {
    id: field.id,
    tenantId: field.tenantId,
    system: field.system,
    active: field.active,
    labelKz: field.labelKz,
    labelRu: field.labelRu,
    labelEn: field.labelEn,
    type: field.type,
    directoryId: field.directoryId,
    options: directoryItems(store, field.directoryId),
  };
}

export const isGlobalActiveForTenant = (store: Store, tenantId: string, field: FieldRecord) =>
  field.active && (store.tenantActive[tenantId] ?? store.globals.map((f) => f.id)).includes(field.id);

/** Поля, доступные организации: включённые глобальные и активные собственные */
export function fieldsForTenant(tenantId: string, store = loadProfileFields()): FieldRecord[] {
  return [
    ...store.globals.filter((f) => isGlobalActiveForTenant(store, tenantId, f)),
    ...store.custom.filter((f) => f.tenantId === tenantId && f.active),
  ];
}

export const findField = (store: Store, tenantId: string, fieldId: string) =>
  store.globals.find((f) => f.id === fieldId) ?? store.custom.find((f) => f.id === fieldId && f.tenantId === tenantId);

// ---------- Схемы ----------

export function ensureDefaultScheme(tenantId: string): SchemeRecord {
  const store = loadProfileFields();
  let scheme = store.schemes.find((s) => s.tenantId === tenantId && s.isDefault);
  if (!scheme) {
    scheme = {
      id: `${tenantId}-profile-default`,
      tenantId,
      name: 'Основная схема',
      isDefault: true,
      fields: fieldsForTenant(tenantId, store).map((f) => ({ fieldId: f.id, required: false })),
    };
    store.schemes.push(scheme);
    saveProfileFields(store);
  }
  return scheme;
}

export const schemesForTenant = (tenantId: string): SchemeRecord[] => {
  ensureDefaultScheme(tenantId);
  return loadProfileFields().schemes.filter((s) => s.tenantId === tenantId);
};

export const toScheme = (scheme: SchemeRecord, groupsCount: number): ProfileFieldScheme => ({ ...scheme, groupsCount });

// ---------- Анкета ----------

export interface AccountData {
  iin: string;
  fullName: string;
  email: string;
  phone: string;
  region?: string | null;
}

export const valueKey = (tenantId: string, userId: string) => `${tenantId}:${userId}`;

/** Поля анкеты по строкам схемы; значения из учётной записи подставляются и считаются заполненными */
export function formFields(
  store: Store,
  tenantId: string,
  userId: string,
  account: AccountData,
  rows: ProfileFieldSchemeRow[],
): ProfileFormField[] {
  const values = store.values[valueKey(tenantId, userId)] ?? {};
  return rows.flatMap((row) => {
    const field = findField(store, tenantId, row.fieldId);
    if (!field) return [];
    const available = field.tenantId === null ? isGlobalActiveForTenant(store, tenantId, field) : field.active;
    if (!available) return [];
    const fromAccount = field.source ? (account[field.source] ?? '') : '';
    return [
      {
        id: field.id,
        label: field.labelRu,
        type: field.type,
        required: row.required,
        value: field.source ? fromAccount : (values[field.id] ?? ''),
        options: directoryItems(store, field.directoryId).map((o) => ({ id: o.id, label: o.labelRu })),
        readonly: Boolean(field.source),
      },
    ];
  });
}

export const missingCount = (fields: ProfileFormField[]) => fields.filter((f) => f.required && !f.value.trim()).length;

/** Поля, значение которых берётся из учётной записи: в анкете не редактируются */
export const isAccountField = (store: Store, fieldId: string) => Boolean(store.globals.find((f) => f.id === fieldId)?.source);

/** Строки анкеты тренера: глобальные поля суперадминистратора и схема, выбранная организацией */
export function trainerRows(store: Store, tenantId: string): ProfileFieldSchemeRow[] {
  const scheme = store.schemes.find((s) => s.id === store.trainerSchemeByTenant[tenantId] && s.tenantId === tenantId);
  const rows: ProfileFieldSchemeRow[] = store.globals
    .filter((f) => f.inTrainerProfile)
    .map((f) => ({ fieldId: f.id, required: Boolean(f.trainerRequired) }));
  for (const row of scheme?.fields ?? []) {
    const current = rows.find((r) => r.fieldId === row.fieldId);
    if (current) current.required ||= row.required;
    else rows.push({ ...row });
  }
  return rows;
}

// ---------- Прогресс ----------

export function progressFor(groupId: string, userId: string, store = loadProfileFields()): ProgressRecord {
  let item = store.progress.find((x) => x.groupId === groupId && x.userId === userId);
  if (!item) {
    item = { groupId, userId, elements: {} };
    store.progress.push(item);
  }
  return item;
}

export const findProgress = (groupId: string, userId: string, store = loadProfileFields()) =>
  store.progress.find((x) => x.groupId === groupId && x.userId === userId);

export type ElementKind = 'test' | 'work' | 'view';
export const kindOf = (element: Pick<CourseElement, 'type'>): ElementKind =>
  element.type === 'test' ? 'test' : element.type === 'assignment' || element.type === 'reflection' ? 'work' : 'view';

export function elementProgress(element: Pick<CourseElement, 'type'>, state: ElementState | undefined): ElementProgress {
  const kind = kindOf(element);
  if (kind === 'test') {
    if (state?.test?.passed) return { status: 'TEST_PASSED', score: state.test.score, maxScore: state.test.maxScore, answer: null };
    if (state?.test) return { status: 'TEST_NOT_PASSED', score: state.test.score, maxScore: state.test.maxScore, answer: null };
    return { status: state?.testStarted ? 'TEST_IN_PROGRESS' : 'TEST_NOT_PASSED', score: null, maxScore: null, answer: null };
  }
  if (kind === 'work') {
    if (!state?.work) return { status: 'WORK_NOT_STARTED', score: null, maxScore: null, answer: null };
    return { status: state.work.done ? 'WORK_DONE' : 'WORK_ON_REVIEW', score: state.work.score, maxScore: null, answer: state.work.answer };
  }
  return { status: state?.viewed ? 'VIEWED' : 'NOT_VIEWED', score: null, maxScore: null, answer: null };
}

/** Элемент засчитан слушателю: материал просмотрен, тест сдан, работа отправлена */
export function isCompleted(element: Pick<CourseElement, 'type'>, state: ElementState | undefined) {
  const status = elementProgress(element, state).status;
  return status === 'VIEWED' || status === 'TEST_PASSED' || status === 'WORK_ON_REVIEW' || status === 'WORK_DONE';
}

export function percentOf(elements: CourseElement[], record: ProgressRecord | undefined) {
  if (!elements.length) return 0;
  const done = elements.filter((e) => isCompleted(e, record?.elements[e.id])).length;
  return Math.round((done / elements.length) * 100);
}

// ---------- Тесты ----------

const AUTO_TYPES = new Set(['single', 'multiple', 'numeric', 'short']);
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

function isCorrect(q: TestQuestion, answer: string | string[] | undefined): boolean {
  if (answer === undefined) return false;
  switch (q.type) {
    case 'single':
      return typeof answer === 'string' && q.options.some((o) => o.correct && o.id === answer);
    case 'multiple': {
      const picked = new Set(Array.isArray(answer) ? answer : [answer]);
      const correct = q.options.filter((o) => o.correct).map((o) => o.id);
      return correct.length === picked.size && correct.every((id) => picked.has(id));
    }
    case 'numeric': {
      const value = Number(String(answer).replace(',', '.'));
      return q.numeric_value !== null && Number.isFinite(value) && Math.abs(value - q.numeric_value) <= (q.numeric_tolerance ?? 0);
    }
    case 'short':
      return q.short_answers
        .split('\n')
        .map(normalize)
        .filter(Boolean)
        .includes(normalize(String(answer)));
    default:
      return false;
  }
}

/** Автоматическая проверка: выбор, число и короткий ответ. Остальные типы вопросов проверяет тренер. */
export function gradeTest(element: CourseElement, answers: TestAnswers): Omit<TestResult, 'dryRun'> {
  const s = element.settings as unknown as TestSettings;
  const questions = s.questions ?? [];
  const auto = questions.filter((q) => AUTO_TYPES.has(q.type));
  const maxScore = auto.reduce((sum, q) => sum + (q.points || 0), 0);
  const score = auto.reduce((sum, q) => sum + (isCorrect(q, answers[q.id]) ? q.points || 0 : 0), 0);
  const percent = maxScore ? Math.round((score / maxScore) * 100) : 0;
  return { score, maxScore, percent, passed: maxScore > 0 && percent >= (s.pass_percent ?? 0), manualQuestions: questions.length - auto.length };
}

/** Контент для слушателя: верные ответы теста не передаются */
export function withoutAnswers(element: CourseElement): CourseElement {
  if (element.type !== 'test') return element;
  const s = element.settings as unknown as TestSettings;
  return {
    ...element,
    settings: {
      ...s,
      questions: (s.questions ?? []).map((q) => ({
        ...q,
        options: q.options.map((o) => ({ ...o, correct: false })),
        numeric_value: null,
        numeric_tolerance: 0,
        short_answers: '',
        gap_answers: [],
        rows: q.rows.map((r) => ({ ...r, correct: 0 })),
      })),
    } as unknown as Record<string, unknown>,
  };
}
