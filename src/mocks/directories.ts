/**
 * Записи справочников для мок-бэкенда. tenantId = null — глобальная запись суперадминистратора,
 * иначе — локальная запись организации, которую видит только она:
 * WHERE tenant_id IS NULL OR tenant_id = :current_tenant_id.
 */
import { DIRECTORIES, type DirectoryCode } from '@/shared/directories';
import { REGIONS } from './users';

export interface DirectoryRecord {
  id: string;
  code: DirectoryCode;
  tenantId: string | null;
  nameKz: string;
  nameRu: string;
  /** Район — запись справочника «Область» */
  parentId: string | null;
  createdAt: string;
}

const STORAGE_KEY = 'superadmin-mock-directories-v1';

const REGION_KZ: Record<string, string> = {
  'Абайская область': 'Абай облысы',
  'Акмолинская область': 'Ақмола облысы',
  'Актюбинская область': 'Ақтөбе облысы',
  'Алматинская область': 'Алматы облысы',
  'Атырауская область': 'Атырау облысы',
  'Восточно-Казахстанская область': 'Шығыс Қазақстан облысы',
  'Жамбылская область': 'Жамбыл облысы',
  'Жетысуская область': 'Жетісу облысы',
  'Западно-Казахстанская область': 'Батыс Қазақстан облысы',
  'Карагандинская область': 'Қарағанды облысы',
  'Костанайская область': 'Қостанай облысы',
  'Кызылординская область': 'Қызылорда облысы',
  'Мангистауская область': 'Маңғыстау облысы',
  'Павлодарская область': 'Павлодар облысы',
  'Северо-Казахстанская область': 'Солтүстік Қазақстан облысы',
  'Туркестанская область': 'Түркістан облысы',
  'Улытауская область': 'Ұлытау облысы',
  'г. Астана': 'Астана қ.',
  'г. Алматы': 'Алматы қ.',
  'г. Шымкент': 'Шымкент қ.',
};

/** [на казахском, на русском] */
const SEED: Partial<Record<DirectoryCode, [string, string][]>> = {
  course_format: [
    ['Онлайн', 'Онлайн'],
    ['Офлайн', 'Офлайн'],
    ['Аралас', 'Смешанный'],
  ],
  course_assessment: [
    ['Сыртқы', 'Внешнее'],
    ['Ішкі', 'Внутреннее'],
  ],
  language: [
    ['Қазақ тілі', 'Казахский'],
    ['Орыс тілі', 'Русский'],
    ['Ағылшын тілі', 'Английский'],
  ],
  gender: [
    ['Ер', 'Мужской'],
    ['Әйел', 'Женский'],
  ],
  nationality: [
    ['Қазақ', 'Казах'],
    ['Орыс', 'Русский'],
    ['Өзбек', 'Узбек'],
    ['Ұйғыр', 'Уйгур'],
    ['Украин', 'Украинец'],
    ['Татар', 'Татарин'],
  ],
  subject: [
    ['Математика', 'Математика'],
    ['Қазақ тілі', 'Казахский язык'],
    ['Орыс тілі', 'Русский язык'],
    ['Ағылшын тілі', 'Английский язык'],
    ['Физика', 'Физика'],
    ['Химия', 'Химия'],
    ['Биология', 'Биология'],
    ['Информатика', 'Информатика'],
    ['Тарих', 'История'],
  ],
  position: [
    ['Директор', 'Директор'],
    ['Директор орынбасары', 'Заместитель директора'],
    ['Мұғалім', 'Учитель'],
    ['Әдіскер', 'Методист'],
    ['Бөлім басшысы', 'Руководитель отдела'],
    ['Маман', 'Специалист'],
  ],
  education: [
    ['Жоғары', 'Высшее'],
    ['Орта арнаулы', 'Средне-специальное'],
    ['Орта', 'Среднее'],
  ],
  science_level: [
    ['Бакалавр', 'Бакалавр'],
    ['Магистр', 'Магистр'],
    ['PhD докторы', 'Доктор PhD'],
    ['Ғылым кандидаты', 'Кандидат наук'],
    ['Ғылым докторы', 'Доктор наук'],
  ],
  category: [
    ['Педагог', 'Педагог'],
    ['Педагог-модератор', 'Педагог-модератор'],
    ['Педагог-сарапшы', 'Педагог-эксперт'],
    ['Педагог-зерттеуші', 'Педагог-исследователь'],
    ['Педагог-шебер', 'Педагог-мастер'],
  ],
  trainer_category: [
    ['Штаттық тренер', 'Штатный тренер'],
    ['Шақырылған тренер', 'Привлеченный тренер'],
  ],
  education_org: [
    ['Назарбаев Зияткерлік мектебі', 'Назарбаев Интеллектуальная школа'],
    ['Әл-Фараби атындағы ҚазҰУ', 'КазНУ имени аль-Фараби'],
    ['Л.Н. Гумилев атындағы ЕҰУ', 'ЕНУ имени Л.Н. Гумилева'],
    ['Алматы политехникалық колледжі', 'Алматинский политехнический колледж'],
  ],
};

const DISTRICTS: Record<string, [string, string][]> = {
  'г. Астана': [
    ['Алматы ауданы', 'район Алматы'],
    ['Есіл ауданы', 'район Есиль'],
    ['Сарыарқа ауданы', 'район Сарыарка'],
    ['Байқоңыр ауданы', 'район Байконур'],
  ],
  'г. Алматы': [
    ['Алмалы ауданы', 'Алмалинский район'],
    ['Бостандық ауданы', 'Бостандыкский район'],
    ['Әуезов ауданы', 'Ауэзовский район'],
    ['Медеу ауданы', 'Медеуский район'],
  ],
  'г. Шымкент': [
    ['Абай ауданы', 'Абайский район'],
    ['Әл-Фараби ауданы', 'район Аль-Фараби'],
  ],
};

function seed(): DirectoryRecord[] {
  const at = new Date().toISOString();
  const make = (code: DirectoryCode, nameKz: string, nameRu: string, i: number, parentId: string | null = null): DirectoryRecord => ({
    id: `dir-${code}-${i}`,
    code,
    tenantId: null,
    nameKz,
    nameRu,
    parentId,
    createdAt: at,
  });
  const regions = REGIONS.map((r, i) => make('region', REGION_KZ[r.name] ?? r.name, r.name, i));
  const districts = Object.entries(DISTRICTS).flatMap(([region, list], n) =>
    list.map(([kz, ru], i) => make('district', kz, ru, n * 100 + i, regions.find((r) => r.nameRu === region)?.id ?? null)),
  );
  const rest = DIRECTORIES.flatMap((d) => (SEED[d.code] ?? []).map(([kz, ru], i) => make(d.code, kz, ru, i)));
  // Локальная запись другой организации: Academy её не видит
  const local: DirectoryRecord = { ...make('position', 'Алаң үйлестірушісі', 'Координатор площадок', 900), tenantId: '7c9e6679-7425-40de-944b-000000000002' };
  return [...rest, ...regions, ...districts, local];
}

let memory: DirectoryRecord[] | null = null;

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadDirectories(): DirectoryRecord[] {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (raw) {
      memory = JSON.parse(raw) as DirectoryRecord[];
      return memory;
    }
  } catch {
    /* повреждённые данные — пересоздаём */
  }
  if (!memory) memory = seed();
  return memory;
}

export function saveDirectories(items: DirectoryRecord[]) {
  memory = items;
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* остаёмся в памяти */
  }
}

export function resetDirectories() {
  memory = null;
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Видимые записи: глобальные ∪ локальные этой организации. Без организации — только глобальные. */
export function visibleItems(code: DirectoryCode, tenantId: string | null): DirectoryRecord[] {
  return loadDirectories().filter((i) => i.code === code && (i.tenantId === null || i.tenantId === tenantId));
}

/** Значение формы допустимо, только если запись этого справочника видна организации */
export function isVisibleItem(id: string, code: DirectoryCode, tenantId: string | null): boolean {
  return visibleItems(code, tenantId).some((i) => i.id === id);
}

export const itemName = (id: string | null | undefined) => (id ? (loadDirectories().find((i) => i.id === id)?.nameRu ?? null) : null);

/** Локальные записи удаляются вместе с организацией */
export function removeDirectoriesOf(tenantId: string) {
  saveDirectories(loadDirectories().filter((i) => i.tenantId !== tenantId));
}
