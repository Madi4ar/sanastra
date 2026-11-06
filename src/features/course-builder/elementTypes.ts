/**
 * Элементы контента конструктора курсов: типы, подписи, настройки по умолчанию,
 * проверка настроек и готовности. Перенесено из ESUS LMS (App\Lms\Programs\ElementSettings,
 * resources/lang/ru/lms.php). Общий модуль для интерфейса и мок-сервера.
 */
import type { CourseElement, ElementFile, ElementType } from '@/api/types';

export const ELEMENT_TYPES: ElementType[] = [
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

export const ELEMENT_LABEL: Record<ElementType, string> = {
  text: 'Лонгрид',
  video: 'Видео',
  interactive_video: 'Интерактивное видео',
  audio: 'Аудио',
  document: 'Документ',
  presentation: 'Презентация',
  folder: 'Папка',
  image: 'Картинка',
  link: 'Ссылка',
  scorm: 'SCORM-пакет',
  assignment: 'Практическая работа',
  table: 'Интерактивная таблица',
  test: 'Тест',
  survey: 'Анкета',
  reflection: 'Вопрос для рефлексии',
};

export const ELEMENT_HINT: Record<ElementType, string> = {
  text: 'Лонгрид из блоков',
  video: 'Ссылка YouTube, Vimeo, Kinescope или файл',
  interactive_video: 'Видео с вопросами и паузами',
  audio: 'Аудиолекция',
  document: 'PDF, DOCX, XLSX для просмотра и скачивания',
  presentation: 'PPTX или PDF',
  folder: 'Файлы любых форматов, папки внутри папок',
  image: 'Схема, инфографика, плакат',
  link: 'Внешний ресурс',
  scorm: 'Интерактивный модуль SCORM 1.2 или 2004',
  assignment: 'Проверяет тренер, ставит балл',
  table: 'Слушатель заполняет ячейки, проверяет тренер',
  test: 'Вопросы с автоматической проверкой',
  survey: 'Обратная связь от слушателя',
  reflection: 'Короткий ответ без оценки',
};

/** Типы, содержимое которых — загруженные файлы */
export const FILE_TYPES: ElementType[] = ['video', 'interactive_video', 'audio', 'document', 'presentation', 'folder', 'image', 'scorm'];
/** Типы с одним основным файлом: новая загрузка заменяет старую */
export const SINGLE_FILE_TYPES: ElementType[] = ['video', 'interactive_video', 'audio', 'scorm'];

export const UPLOAD_HINT: Partial<Record<ElementType, string>> = {
  video: 'MP4, WebM, MOV',
  interactive_video: 'MP4, WebM, MOV',
  audio: 'MP3, M4A, WAV, OGG',
  document: 'PDF, Word, Excel, PowerPoint — Word и PowerPoint покажем как PDF',
  presentation: 'PowerPoint или PDF — покажем как PDF',
  folder: 'Документы, таблицы, презентации, архивы, картинки, видео, аудио — до 1 ГБ',
  image: 'JPG, PNG, WebP, GIF, SVG',
  scorm: 'ZIP с imsmanifest.xml внутри',
};

export const UPLOAD_ACCEPT: Partial<Record<ElementType, string>> = {
  video: '.mp4,.webm,.mov',
  interactive_video: '.mp4,.webm,.mov',
  audio: '.mp3,.m4a,.wav,.ogg',
  document: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx',
  presentation: '.ppt,.pptx,.pdf',
  image: '.jpg,.jpeg,.png,.webp,.gif,.svg',
  scorm: '.zip',
};

/** Вкладки окна настроек по типам (ElementSettings::tabs) */
export type SettingsTab = 'main' | 'playback' | 'timeline' | 'submission' | 'dates' | 'grading' | 'display' | 'rules' | 'questions' | 'feedback' | 'blocks' | 'grid';

export const TAB_LABEL: Record<SettingsTab, string> = {
  main: 'Основное',
  playback: 'Воспроизведение',
  timeline: 'События на таймлайне',
  submission: 'Сдача',
  dates: 'Сроки',
  grading: 'Оценивание',
  display: 'Отображение',
  rules: 'Правила прохождения',
  questions: 'Вопросы',
  feedback: 'Обратная связь',
  blocks: 'Блоки',
  grid: 'Таблица',
};

export function tabsOf(type: ElementType): SettingsTab[] {
  const tabs: Partial<Record<ElementType, SettingsTab[]>> = {
    video: ['main', 'playback'],
    interactive_video: ['main', 'timeline', 'playback'],
    text: ['main', 'blocks'],
    assignment: ['main', 'submission', 'dates', 'grading'],
    table: ['main', 'grid', 'dates', 'grading'],
    scorm: ['main', 'grading', 'display'],
    test: ['main', 'rules', 'questions', 'feedback'],
    survey: ['main', 'questions'],
  };
  return tabs[type] ?? ['main'];
}

// ---- настройки по типам ----

export interface VideoSettings {
  source: 'url' | 'file';
  url: string | null;
  duration_min: number | null;
  watch_percent: number;
  no_seek_first: boolean;
  speed_control: boolean;
  note_ru: string;
  note_kz: string;
}

export const EVENT_KINDS = ['question', 'pause', 'chapter', 'hotspot', 'branch'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export const EVENT_LABEL: Record<EventKind, string> = {
  question: 'Вопрос в видео',
  pause: 'Пауза с заданием',
  chapter: 'Глава',
  hotspot: 'Подсказка',
  branch: 'Ветвление',
};

export const QUESTION_KINDS = ['single', 'multiple', 'truefalse', 'text'] as const;
export type VideoQuestionKind = (typeof QUESTION_KINDS)[number];
export const VIDEO_QUESTION_LABEL: Record<VideoQuestionKind, string> = {
  single: 'Один ответ',
  multiple: 'Несколько ответов',
  truefalse: 'Верно / неверно',
  text: 'Свободный ответ',
};

export interface TimelineOption {
  id: string;
  ru: string;
  kz: string;
  correct: boolean;
  /** Ветвление: на какую секунду перейти */
  goto: number | null;
}

export interface TimelineEvent {
  id: string;
  /** Секунда видео */
  at: number;
  kind: EventKind;
  title_ru: string;
  title_kz: string;
  text_ru: string;
  text_kz: string;
  url: string | null;
  question_kind: VideoQuestionKind | null;
  options: TimelineOption[];
  autopause: boolean;
}

export interface InteractiveVideoSettings extends VideoSettings {
  events: TimelineEvent[];
  pass_percent: number;
  on_fail: 'rewind' | 'retry';
}

export const BLOCK_KINDS = ['heading', 'paragraph', 'list', 'image', 'quote', 'callout', 'accordion', 'file', 'embed', 'table'] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];
export const BLOCK_LABEL: Record<BlockKind, string> = {
  heading: 'Заголовок',
  paragraph: 'Абзац',
  list: 'Список',
  image: 'Картинка',
  quote: 'Цитата',
  callout: 'Выноска',
  accordion: 'Аккордеон',
  file: 'Файл',
  embed: 'Встраивание',
  table: 'Таблица',
};
export type CalloutTone = 'info' | 'tip' | 'warning';
export const TONE_LABEL: Record<CalloutTone, string> = { info: 'Справка', tip: 'Совет', warning: 'Важно' };
/** Блоки, у которых есть заголовок/подпись */
export const BLOCK_HAS_TITLE: BlockKind[] = ['accordion', 'callout', 'image', 'file', 'embed', 'table'];
/** Блоки с основным текстом */
export const BLOCK_HAS_TEXT: BlockKind[] = ['heading', 'paragraph', 'list', 'quote', 'callout', 'accordion', 'table'];

export interface LongreadBlock {
  id: string;
  kind: BlockKind;
  title_ru: string;
  title_kz: string;
  text_ru: string;
  text_kz: string;
  tone: CalloutTone;
  url: string | null;
  /** Файл элемента (для картинки и файла) */
  file_id: string | null;
}

export interface LongreadSettings {
  blocks: LongreadBlock[];
  read_min_ru: number | null;
  read_min_kz: number | null;
  show_progress: boolean;
  auto_toc: boolean;
  confirm_read: boolean;
}

export interface AudioSettings {
  duration_min: number | null;
  speed_control: boolean;
  transcript_ru: string;
  transcript_kz: string;
}

export interface FileViewSettings {
  downloadable: boolean;
  preview: boolean;
}

export interface FolderNode {
  id: string;
  /** null — корень элемента */
  parentId: string | null;
  title_ru: string;
  title_kz: string;
}

export interface FolderSettings extends FileViewSettings {
  folders: FolderNode[];
}
export const MAX_FOLDERS = 50;
export const MAX_FOLDER_DEPTH = 5;

export interface ImageSettings {
  caption_ru: string;
  caption_kz: string;
  zoom: boolean;
}

export interface LinkSettings {
  /** Ссылка на казахском или единственная */
  url: string | null;
  /** Ссылка на русском, если отличается */
  url_ru: string | null;
  note_ru: string;
  note_kz: string;
  embed: boolean;
}

export interface ScormSettings {
  version: '1.2' | '2004';
  complete_on: 'completed' | 'passed';
  display: 'embedded' | 'new_window';
  allow_fullscreen: boolean;
  max_attempts: number | null;
  grading: 'highest' | 'last' | 'first';
  pass_score: number | null;
}

export type Deadline = 'day_end' | 'next_day' | 'course_end' | 'date';
export const DEADLINE_LABEL: Record<Deadline, string> = {
  day_end: 'До конца учебного дня',
  next_day: 'До конца следующего дня',
  course_end: 'До конца курса',
  date: 'До даты',
};
export type Cutoff = 'always' | 'none' | '1d' | '3d' | '7d';
export const CUTOFF_LABEL: Record<Cutoff, string> = {
  always: 'Принимать всегда',
  none: 'Не принимать',
  '1d': '1 день',
  '3d': '3 дня',
  '7d': '7 дней',
};
export type AnswerKind = 'text_or_file' | 'text' | 'file';
export const ANSWER_LABEL: Record<AnswerKind, string> = {
  text_or_file: 'Текстом или файлами',
  text: 'Только текстом',
  file: 'Только файлами',
};
export const SIZES_MB = [5, 10, 25, 50, 100, 250, 500];

export interface WorkSettings {
  task_ru: string;
  task_kz: string;
  criteria_ru: string;
  criteria_kz: string;
  graded: boolean;
  max_score: number;
  pass_score: number;
  deadline: Deadline;
  due_date: string | null;
  cutoff: Cutoff;
  allow_resubmit: boolean;
  max_rounds: number;
}

export interface AssignmentSettings extends WorkSettings {
  answer: AnswerKind;
  max_files: number;
  max_size_mb: number;
}

export interface TableCell {
  id: string;
  /** Ячейка, которую заполняет слушатель (ru/kz — подсказка) */
  input: boolean;
  ru: string;
  kz: string;
}
export interface TableRow {
  id: string;
  cells: TableCell[];
}
export interface TableGrid {
  header_row: boolean;
  header_col: boolean;
  rows: TableRow[];
}
export const TABLE_MAX_ROWS = 60;
export const TABLE_MAX_COLS = 12;

export interface TableSettings extends WorkSettings {
  table: TableGrid;
}

export const TEST_KINDS = ['input', 'module', 'final', 'exit'] as const;
export type TestKind = (typeof TEST_KINDS)[number];
export const TEST_KIND_LABEL: Record<TestKind, string> = {
  input: 'Входной',
  module: 'Модульный',
  final: 'Итоговый',
  exit: 'Выходной',
};
export type Cooldown = 'none' | 'hour' | 'next_day';
export const COOLDOWN_LABEL: Record<Cooldown, string> = { none: 'Сразу', hour: 'Через час', next_day: 'На следующий день' };
export type Counted = 'best' | 'last' | 'first_pass';
export const COUNTED_LABEL: Record<Counted, string> = {
  best: 'Лучшая попытка',
  last: 'Последняя попытка',
  first_pass: 'Первая успешная',
};

export const QTYPES = ['single', 'multiple', 'matching', 'ordering', 'gaps', 'numeric', 'short', 'matrix', 'essay'] as const;
export type QType = (typeof QTYPES)[number];
export const QTYPE_LABEL: Record<QType, string> = {
  single: 'Один ответ',
  multiple: 'Несколько ответов',
  matching: 'Соответствие',
  ordering: 'Упорядочивание',
  gaps: 'Пропуски в тексте',
  numeric: 'Числовой ответ',
  short: 'Короткий ответ',
  matrix: 'Матрица',
  essay: 'Эссе',
};
export const QTYPE_HINT: Record<QType, string> = {
  single: 'Выбрать один верный вариант',
  multiple: 'Выбрать все верные варианты',
  matching: 'Соотнести левую и правую колонки',
  ordering: 'Расставить пункты по порядку',
  gaps: 'Вписать слова в пропуски',
  numeric: 'Ввести число',
  short: 'Ввести слово или фразу',
  matrix: 'Ответ по строкам: верно / неверно и т. п.',
  essay: 'Ответ своими словами, без баллов',
};

export interface LangItem {
  id: string;
  ru: string;
  kz: string;
}
export interface ChoiceOption extends LangItem {
  correct: boolean;
}
export interface MatchPair {
  id: string;
  left_ru: string;
  left_kz: string;
  right_ru: string;
  right_kz: string;
}
export interface MatrixRow extends LangItem {
  /** Индекс верного столбца */
  correct: number;
}

export interface TestQuestion {
  id: string;
  type: QType;
  text_ru: string;
  text_kz: string;
  /** Тема — для аналитики */
  topic: string;
  points: number;
  options: ChoiceOption[];
  pairs: MatchPair[];
  items: LangItem[];
  /** Пропуски: [[1]], [[2]]… — верные ответы для каждого через «;» */
  gaps_ru: string;
  gaps_kz: string;
  gap_answers: string[];
  numeric_value: number | null;
  numeric_tolerance: number;
  /** Короткий ответ: верные варианты, по одному в строке */
  short_answers: string;
  rows: MatrixRow[];
  cols: LangItem[];
  essay_feedback_ru: string;
  essay_feedback_kz: string;
}

export interface TestSettings {
  kind: TestKind;
  attempts: number | null;
  time_limit: number | null;
  pass_percent: number;
  cooldown: Cooldown;
  counted: Counted;
  questions_per_page: number;
  pick_count: number | null;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  show_percent: boolean;
  feedback_pass_ru: string;
  feedback_pass_kz: string;
  feedback_fail_ru: string;
  feedback_fail_kz: string;
  questions: TestQuestion[];
}

export const SURVEY_KINDS = ['text', 'single', 'multiple', 'scale'] as const;
export type SurveyKind = (typeof SURVEY_KINDS)[number];
export const SURVEY_KIND_LABEL: Record<SurveyKind, string> = {
  text: 'Свободный ответ',
  single: 'Один вариант',
  multiple: 'Несколько вариантов',
  scale: 'Шкала 1–5',
};
export interface SurveyQuestion {
  id: string;
  kind: SurveyKind;
  ru: string;
  kz: string;
  required: boolean;
  options: LangItem[];
}
export interface SurveySettings {
  /** Анкета открывается после обязательных элементов курса */
  after_required: boolean;
  anonymous: boolean;
  questions: SurveyQuestion[];
}

export interface ReflectionSettings {
  question_ru: string;
  question_kz: string;
  limit: number;
}

export interface SettingsByType {
  text: LongreadSettings;
  video: VideoSettings;
  interactive_video: InteractiveVideoSettings;
  audio: AudioSettings;
  document: FileViewSettings;
  presentation: FileViewSettings;
  folder: FolderSettings;
  image: ImageSettings;
  link: LinkSettings;
  scorm: ScormSettings;
  assignment: AssignmentSettings;
  table: TableSettings;
  test: TestSettings;
  survey: SurveySettings;
  reflection: ReflectionSettings;
}

export const uid = (prefix = 'x') => `${prefix}${Math.random().toString(36).slice(2, 10)}`;

const WORK_DEFAULTS: WorkSettings = {
  task_ru: '',
  task_kz: '',
  criteria_ru: '',
  criteria_kz: '',
  graded: true,
  max_score: 10,
  pass_score: 6,
  deadline: 'day_end',
  due_date: null,
  cutoff: 'always',
  allow_resubmit: true,
  max_rounds: 3,
};

export function blankGrid(): TableGrid {
  const cell = (input: boolean): TableCell => ({ id: uid('c'), input, ru: '', kz: '' });
  return {
    header_row: true,
    header_col: false,
    rows: [
      { id: uid('r'), cells: [cell(false), cell(false)] },
      { id: uid('r'), cells: [cell(false), cell(true)] },
      { id: uid('r'), cells: [cell(false), cell(true)] },
    ],
  };
}

export function blankQuestion(type: QType): TestQuestion {
  const option = (correct = false): ChoiceOption => ({ id: uid('o'), ru: '', kz: '', correct });
  return {
    id: uid('q'),
    type,
    text_ru: '',
    text_kz: '',
    topic: '',
    points: type === 'essay' ? 0 : 1,
    options: type === 'single' || type === 'multiple' ? [option(true), option(), option()] : [],
    pairs:
      type === 'matching'
        ? Array.from({ length: 3 }, () => ({ id: uid('p'), left_ru: '', left_kz: '', right_ru: '', right_kz: '' }))
        : [],
    items: type === 'ordering' ? Array.from({ length: 3 }, () => ({ id: uid('i'), ru: '', kz: '' })) : [],
    gaps_ru: '',
    gaps_kz: '',
    gap_answers: [],
    numeric_value: null,
    numeric_tolerance: 0,
    short_answers: '',
    rows: type === 'matrix' ? [{ id: uid('m'), ru: '', kz: '', correct: 0 }] : [],
    cols:
      type === 'matrix'
        ? [
            { id: uid('k'), ru: 'Верно', kz: 'Дұрыс', },
            { id: uid('k'), ru: 'Неверно', kz: 'Бұрыс' },
          ]
        : [],
    essay_feedback_ru: '',
    essay_feedback_kz: '',
  };
}

export function blankEvent(at: number, kind: EventKind = 'question'): TimelineEvent {
  return {
    id: uid('e'),
    at,
    kind,
    title_ru: '',
    title_kz: '',
    text_ru: '',
    text_kz: '',
    url: null,
    question_kind: kind === 'question' ? 'single' : null,
    options:
      kind === 'question' || kind === 'branch'
        ? [
            { id: uid('o'), ru: '', kz: '', correct: kind === 'question', goto: null },
            { id: uid('o'), ru: '', kz: '', correct: false, goto: null },
          ]
        : [],
    autopause: kind === 'question' || kind === 'pause' || kind === 'branch',
  };
}

export function blankBlock(kind: BlockKind): LongreadBlock {
  return { id: uid('b'), kind, title_ru: '', title_kz: '', text_ru: '', text_kz: '', tone: 'info', url: null, file_id: null };
}

/** Настройки по умолчанию для нового элемента (ElementSettings::defaults) */
export function defaultSettings<T extends ElementType>(type: T): SettingsByType[T] {
  const video: VideoSettings = {
    source: 'url',
    url: null,
    duration_min: null,
    watch_percent: 90,
    no_seek_first: false,
    speed_control: true,
    note_ru: '',
    note_kz: '',
  };
  const all: SettingsByType = {
    text: { blocks: [], read_min_ru: null, read_min_kz: null, show_progress: true, auto_toc: true, confirm_read: true },
    video,
    interactive_video: { ...video, no_seek_first: true, events: [], pass_percent: 70, on_fail: 'rewind' },
    audio: { duration_min: null, speed_control: true, transcript_ru: '', transcript_kz: '' },
    document: { downloadable: true, preview: true },
    presentation: { downloadable: true, preview: true },
    folder: { folders: [], downloadable: true, preview: true },
    image: { caption_ru: '', caption_kz: '', zoom: true },
    link: { url: null, url_ru: null, note_ru: '', note_kz: '', embed: true },
    scorm: {
      version: '1.2',
      complete_on: 'completed',
      display: 'embedded',
      allow_fullscreen: true,
      max_attempts: null,
      grading: 'highest',
      pass_score: null,
    },
    assignment: { ...WORK_DEFAULTS, answer: 'text_or_file', max_files: 5, max_size_mb: 25 },
    table: { ...WORK_DEFAULTS, table: blankGrid() },
    test: {
      kind: 'module',
      attempts: 3,
      time_limit: null,
      pass_percent: 70,
      cooldown: 'none',
      counted: 'best',
      questions_per_page: 1,
      pick_count: null,
      shuffle_questions: false,
      shuffle_options: true,
      show_percent: true,
      feedback_pass_ru: '',
      feedback_pass_kz: '',
      feedback_fail_ru: '',
      feedback_fail_kz: '',
      questions: [],
    },
    survey: { after_required: true, anonymous: false, questions: [] },
    reflection: { question_ru: '', question_kz: '', limit: 500 },
  };
  return structuredClone(all[type]);
}

// ---- проверка ----

const URL_RE = /^https?:\/\/\S+$/i;
type Errors = Record<string, string>;

function checkUrl(e: Errors, key: string, v: unknown) {
  if (v === null || v === undefined || v === '') return;
  if (typeof v !== 'string' || !URL_RE.test(v) || v.length > 2000) e[key] = 'Ссылка должна начинаться с http:// или https://';
}

function checkText(e: Errors, key: string, v: unknown, max: number) {
  if (v === null || v === undefined) return;
  if (typeof v !== 'string') e[key] = 'Некорректный текст';
  else if (v.length > max) e[key] = `Не более ${max} символов`;
}

function checkInt(e: Errors, key: string, v: unknown, min: number, max: number, nullable = false) {
  if (nullable && (v === null || v === undefined)) return;
  if (typeof v !== 'number' || !Number.isInteger(v)) e[key] = 'Введите целое число';
  else if (v < min || v > max) e[key] = `От ${min} до ${max}`;
}

function checkWork(e: Errors, s: WorkSettings) {
  for (const k of ['task_ru', 'task_kz', 'criteria_ru', 'criteria_kz'] as const) checkText(e, `settings.${k}`, s[k], 20000);
  if (s.graded) {
    checkInt(e, 'settings.max_score', s.max_score, 1, 100);
    checkInt(e, 'settings.pass_score', s.pass_score, 0, 100);
    if (!e['settings.pass_score'] && !e['settings.max_score'] && s.pass_score > s.max_score)
      e['settings.pass_score'] = 'Не больше максимального балла';
  }
  if (!(s.deadline in DEADLINE_LABEL)) e['settings.deadline'] = 'Выберите срок';
  if (s.deadline === 'date' && !s.due_date) e['settings.due_date'] = 'Укажите дату';
  if (!(s.cutoff in CUTOFF_LABEL)) e['settings.cutoff'] = 'Выберите вариант';
  if (s.allow_resubmit) checkInt(e, 'settings.max_rounds', s.max_rounds, 1, 10);
}

function checkVideo(e: Errors, s: VideoSettings) {
  checkUrl(e, 'settings.url', s.url);
  checkInt(e, 'settings.duration_min', s.duration_min, 1, 600, true);
  checkInt(e, 'settings.watch_percent', s.watch_percent, 10, 100);
  checkText(e, 'settings.note_ru', s.note_ru, 5000);
  checkText(e, 'settings.note_kz', s.note_kz, 5000);
}

/** Проверка элемента (ElementSettings::rules). Ключи ошибок — пути полей. */
export function validateElement(el: Pick<CourseElement, 'type' | 'titleRu' | 'titleKz' | 'settings' | 'files'>): Errors {
  const e: Errors = {};
  const titleRu = el.titleRu.trim();
  const titleKz = el.titleKz.trim();
  if (!titleRu && !titleKz) e.titleRu = 'Укажите название хотя бы на одном языке';
  if (titleRu.length > 255) e.titleRu = 'Не более 255 символов';
  if (titleKz.length > 255) e.titleKz = 'Не более 255 символов';

  switch (el.type) {
    case 'video':
      checkVideo(e, el.settings as unknown as VideoSettings);
      break;
    case 'interactive_video': {
      const s = el.settings as unknown as InteractiveVideoSettings;
      checkVideo(e, s);
      checkInt(e, 'settings.pass_percent', s.pass_percent, 0, 100);
      if (s.events.length > 100) e['settings.events'] = 'Не более 100 событий';
      s.events.forEach((ev, i) => {
        checkInt(e, `settings.events.${i}.at`, ev.at, 0, 36000);
        checkUrl(e, `settings.events.${i}.url`, ev.url);
        if (ev.options.length > 8) e[`settings.events.${i}.options`] = 'Не более 8 вариантов';
        if (ev.kind === 'question' && ev.question_kind !== 'text') {
          if (ev.options.filter((o) => o.ru.trim() || o.kz.trim()).length < 2)
            e[`settings.events.${i}.options`] = 'Нужно минимум два варианта ответа';
          else if (!ev.options.some((o) => o.correct)) e[`settings.events.${i}.options`] = 'Отметьте верный ответ';
        }
        if (ev.kind === 'branch') ev.options.forEach((o, j) => checkInt(e, `settings.events.${i}.options.${j}.goto`, o.goto, 0, 36000));
      });
      break;
    }
    case 'text': {
      const s = el.settings as unknown as LongreadSettings;
      checkInt(e, 'settings.read_min_ru', s.read_min_ru, 1, 600, true);
      checkInt(e, 'settings.read_min_kz', s.read_min_kz, 1, 600, true);
      s.blocks.forEach((b, i) => {
        checkText(e, `settings.blocks.${i}.text_ru`, b.text_ru, 20000);
        checkText(e, `settings.blocks.${i}.text_kz`, b.text_kz, 20000);
        if (b.kind === 'embed') checkUrl(e, `settings.blocks.${i}.url`, b.url);
      });
      break;
    }
    case 'audio': {
      const s = el.settings as unknown as AudioSettings;
      checkInt(e, 'settings.duration_min', s.duration_min, 1, 600, true);
      checkText(e, 'settings.transcript_ru', s.transcript_ru, 50000);
      checkText(e, 'settings.transcript_kz', s.transcript_kz, 50000);
      break;
    }
    case 'folder': {
      const s = el.settings as unknown as FolderSettings;
      if (s.folders.length > MAX_FOLDERS) e['settings.folders'] = `Не больше ${MAX_FOLDERS} папок в одном элементе`;
      const depth = (id: string | null, n = 0): number =>
        id === null || n > MAX_FOLDER_DEPTH ? n : depth(s.folders.find((f) => f.id === id)?.parentId ?? null, n + 1);
      if (s.folders.some((f) => depth(f.id) > MAX_FOLDER_DEPTH))
        e['settings.folders'] = `Не больше ${MAX_FOLDER_DEPTH} уровней вложенности`;
      break;
    }
    case 'image': {
      const s = el.settings as unknown as ImageSettings;
      checkText(e, 'settings.caption_ru', s.caption_ru, 500);
      checkText(e, 'settings.caption_kz', s.caption_kz, 500);
      break;
    }
    case 'link': {
      const s = el.settings as unknown as LinkSettings;
      checkUrl(e, 'settings.url', s.url);
      checkUrl(e, 'settings.url_ru', s.url_ru);
      checkText(e, 'settings.note_ru', s.note_ru, 1000);
      checkText(e, 'settings.note_kz', s.note_kz, 1000);
      break;
    }
    case 'scorm': {
      const s = el.settings as unknown as ScormSettings;
      checkInt(e, 'settings.max_attempts', s.max_attempts, 1, 10, true);
      checkInt(e, 'settings.pass_score', s.pass_score, 0, 100, true);
      break;
    }
    case 'assignment': {
      const s = el.settings as unknown as AssignmentSettings;
      checkWork(e, s);
      if (s.answer !== 'text') {
        checkInt(e, 'settings.max_files', s.max_files, 1, 20);
        if (!SIZES_MB.includes(s.max_size_mb)) e['settings.max_size_mb'] = 'Выберите размер';
      }
      break;
    }
    case 'table': {
      const s = el.settings as unknown as TableSettings;
      checkWork(e, s);
      const rows = s.table.rows;
      if (!rows.length) e['settings.table'] = 'В таблице должна быть хотя бы одна строка';
      else if (rows.length > TABLE_MAX_ROWS) e['settings.table'] = `Не более ${TABLE_MAX_ROWS} строк`;
      else if ((rows[0]?.cells.length ?? 0) > TABLE_MAX_COLS) e['settings.table'] = `Не более ${TABLE_MAX_COLS} столбцов`;
      else if (!rows.some((r) => r.cells.some((c) => c.input)))
        e['settings.table'] = 'Отметьте хотя бы одну ячейку, которую заполняет слушатель';
      break;
    }
    case 'test': {
      const s = el.settings as unknown as TestSettings;
      checkInt(e, 'settings.attempts', s.attempts, 1, 100, true);
      checkInt(e, 'settings.time_limit', s.time_limit, 1, 600, true);
      checkInt(e, 'settings.pass_percent', s.pass_percent, 0, 100);
      checkInt(e, 'settings.questions_per_page', s.questions_per_page, 1, 50);
      checkInt(e, 'settings.pick_count', s.pick_count, 1, 200, true);
      if (s.pick_count && s.pick_count > s.questions.length)
        e['settings.pick_count'] = `В тесте только ${s.questions.length} вопросов`;
      s.questions.forEach((q, i) => {
        const msg = questionError(q);
        if (msg) e[`settings.questions.${i}`] = msg;
      });
      break;
    }
    case 'survey': {
      const s = el.settings as unknown as SurveySettings;
      s.questions.forEach((q, i) => {
        if (!q.ru.trim() && !q.kz.trim()) e[`settings.questions.${i}`] = 'Введите текст вопроса';
        else if ((q.kind === 'single' || q.kind === 'multiple') && q.options.filter((o) => o.ru.trim() || o.kz.trim()).length < 2)
          e[`settings.questions.${i}`] = 'Нужно минимум два варианта';
      });
      break;
    }
    case 'reflection': {
      const s = el.settings as unknown as ReflectionSettings;
      checkText(e, 'settings.question_ru', s.question_ru, 2000);
      checkText(e, 'settings.question_kz', s.question_kz, 2000);
      checkInt(e, 'settings.limit', s.limit, 50, 5000);
      break;
    }
    default:
      break;
  }
  return e;
}

const filled = (a: string, b: string) => Boolean(a.trim() || b.trim());

/** Ошибка в вопросе теста (QuestionForm), null — вопрос корректен */
export function questionError(q: TestQuestion): string | null {
  if (!filled(q.text_ru, q.text_kz) && q.type !== 'gaps') return 'Введите текст вопроса';
  if (q.type !== 'essay' && (!Number.isFinite(q.points) || q.points < 0 || q.points > 100)) return 'Баллы — от 0 до 100';
  switch (q.type) {
    case 'single':
    case 'multiple': {
      const opts = q.options.filter((o) => filled(o.ru, o.kz));
      if (opts.length < 2) return 'Нужно минимум два варианта ответа';
      const correct = opts.filter((o) => o.correct).length;
      if (!correct) return 'Отметьте верный вариант';
      if (q.type === 'single' && correct > 1) return 'В вопросе с одним ответом верный вариант один';
      return null;
    }
    case 'matching':
      return q.pairs.filter((p) => filled(p.left_ru, p.left_kz) && filled(p.right_ru, p.right_kz)).length < 2
        ? 'Нужно минимум две заполненные пары'
        : null;
    case 'ordering':
      return q.items.filter((i) => filled(i.ru, i.kz)).length < 2 ? 'Нужно минимум два пункта' : null;
    case 'gaps': {
      const text = q.gaps_ru || q.gaps_kz;
      const gaps = gapNumbers(text);
      if (!gaps.length) return 'Обозначьте пропуски в тексте: [[1]], [[2]]…';
      if (gaps.some((n) => !(q.gap_answers[n - 1] ?? '').trim())) return 'Укажите верные ответы для каждого пропуска';
      return null;
    }
    case 'numeric':
      if (q.numeric_value === null || !Number.isFinite(q.numeric_value)) return 'Укажите верное число';
      return q.numeric_tolerance < 0 ? 'Отклонение не может быть отрицательным' : null;
    case 'short':
      return q.short_answers.split('\n').some((s) => s.trim()) ? null : 'Укажите хотя бы один верный ответ';
    case 'matrix':
      if (!q.rows.some((r) => filled(r.ru, r.kz))) return 'Добавьте строки-утверждения';
      if (q.cols.filter((c) => filled(c.ru, c.kz)).length < 2) return 'Нужно минимум два столбца';
      return q.rows.some((r) => r.correct >= q.cols.length) ? 'Отметьте верный столбец в каждой строке' : null;
    case 'essay':
      return null;
  }
}

/** Номера пропусков [[n]] в тексте, по возрастанию без повторов */
export function gapNumbers(text: string): number[] {
  return [...new Set([...text.matchAll(/\[\[(\d{1,2})\]\]/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
}

/** Что ещё не заполнено, чтобы слушатель увидел элемент полноценно (Readiness) */
export function readinessIssues(el: Pick<CourseElement, 'type' | 'settings' | 'files' | 'titleRu' | 'titleKz'>): string[] {
  const issues: string[] = [];
  const files = el.files;
  if (!el.titleKz.trim()) issues.push('Нет названия на казахском');
  if (!el.titleRu.trim()) issues.push('Нет названия на русском');
  switch (el.type) {
    case 'video':
    case 'interactive_video': {
      const s = el.settings as unknown as VideoSettings;
      if (s.source === 'url' ? !s.url : !files.length) issues.push(s.source === 'url' ? 'Нет ссылки на видео' : 'Видеофайл не загружен');
      if (el.type === 'interactive_video' && !(el.settings as unknown as InteractiveVideoSettings).events.length)
        issues.push('Нет событий на таймлайне');
      break;
    }
    case 'audio':
    case 'document':
    case 'presentation':
    case 'image':
    case 'scorm':
    case 'folder':
      if (!files.length) issues.push('Файл не загружен');
      break;
    case 'text':
      if (!(el.settings as unknown as LongreadSettings).blocks.length) issues.push('Лонгрид пуст — добавьте блоки');
      break;
    case 'link': {
      const s = el.settings as unknown as LinkSettings;
      if (!s.url && !s.url_ru) issues.push('Нет ссылки');
      break;
    }
    case 'assignment':
    case 'table': {
      const s = el.settings as unknown as WorkSettings;
      if (!s.task_ru.trim() && !s.task_kz.trim()) issues.push('Нет текста задания');
      break;
    }
    case 'test':
      if (!(el.settings as unknown as TestSettings).questions.length) issues.push('В тесте нет вопросов');
      break;
    case 'survey':
      if (!(el.settings as unknown as SurveySettings).questions.length) issues.push('В анкете нет вопросов');
      break;
    case 'reflection': {
      const s = el.settings as unknown as ReflectionSettings;
      if (!s.question_ru.trim() && !s.question_kz.trim()) issues.push('Нет текста вопроса');
      break;
    }
  }
  return issues;
}

export const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} КБ` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`;

/** мм:сс для таймлайна */
export const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
export function parseTime(v: string): number | null {
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(v.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export const fileLangLabel = (f: Pick<ElementFile, 'lang'>) => (f.lang === 'kz' ? 'KZ' : f.lang === 'ru' ? 'RU' : 'KZ + RU');
