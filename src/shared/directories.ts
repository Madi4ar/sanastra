/** 14 глобальных справочников платформы. Каждый — отдельный модуль Реестра с опциями create / edit / delete / view. */
export const DIRECTORIES = [
  { code: 'course_format', name: 'Формат курса' },
  { code: 'course_assessment', name: 'Оценивание курса' },
  { code: 'language', name: 'Язык обучения' },
  { code: 'gender', name: 'Пол' },
  { code: 'nationality', name: 'Национальность' },
  { code: 'region', name: 'Область' },
  { code: 'district', name: 'Район' },
  { code: 'subject', name: 'Предмет' },
  { code: 'position', name: 'Должность' },
  { code: 'education', name: 'Образование' },
  { code: 'science_level', name: 'Научный уровень' },
  { code: 'category', name: 'Категория' },
  { code: 'trainer_category', name: 'Категория тренера' },
  { code: 'education_org', name: 'Название организаций образования' },
] as const;

export type DirectoryCode = (typeof DIRECTORIES)[number]['code'];

/** Модуль Реестра для справочника */
export const directoryModuleKey = (code: string) => `lms_dir_${code}`;

export const isDirectoryCode = (code: string): code is DirectoryCode => DIRECTORIES.some((d) => d.code === code);

/** Модуль тарифа с расширенными классификаторами: справочники «Научный уровень» и «Категория» */
export const ADVANCED_DIRECTORIES_MODULE = 'ADV_DIRECTORIES';
export const ADVANCED_DIRECTORIES: readonly DirectoryCode[] = ['science_level', 'category'];
