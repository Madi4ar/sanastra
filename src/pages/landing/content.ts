/**
 * Данные лендинга Zuie. Блоки «Доверие в цифрах», «Логотипы клиентов» и «Кейс клиента» показываются,
 * только когда соответствующий массив заполнен подтверждёнными данными владельца продукта (ТЗ, разделы 6.3, 6.4, 6.11, 14).
 */

export const BRAND = 'Zuie';
export const SALES_EMAIL = 'hello@zuie.kz';
export const SUPPORT_EMAIL = 'support@zuie.kz';

/** Подтверждённые показатели платформы. Пусто — вместо чисел показывается нейтральная строка доверия. */
export const STATS: { value: string; label: string }[] = [];

/** Логотипы клиентов с письменным разрешением на публикацию (5–8 шт., монохромные). */
export const CLIENT_LOGOS: { name: string; src: string; width: number; height: number }[] = [];

export type CaseStudy = {
  id: string;
  organization: string;
  logo?: { src: string; width: number; height: number };
  problem: string;
  modules: string[];
  results: { label: string; before: string; after: string }[];
  quote: { text: string; author: string; role: string; photo?: string };
  href: string;
};

/** Реальные кейсы с согласованной цитатой и показателями «до / после». */
export const CASES: CaseStudy[] = [];

