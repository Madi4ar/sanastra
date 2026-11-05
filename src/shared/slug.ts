/** Правила адреса кабинета организации (client_slug). Сервер проверяет то же самое. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/** Адреса, занятые маршрутами приложения. */
export const RESERVED_SLUGS = ['superadmin', 'login', 'logout', 'api', '403', '404', 'admin', 'static', 'assets'];

const MAP: Record<string, string> = {
  а: 'a', ә: 'a', б: 'b', в: 'v', г: 'g', ғ: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i',
  к: 'k', қ: 'q', л: 'l', м: 'm', н: 'n', ң: 'n', о: 'o', ө: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ұ: 'u', ү: 'u', ф: 'f', х: 'kh', һ: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', і: 'i',
  ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/** Черновик адреса из названия: транслитерация (рус/каз), нижний регистр, дефисы. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .split('')
    .map((ch) => MAP[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export function slugError(slug: string): string | null {
  if (!slug) return 'Укажите адрес кабинета';
  if (!SLUG_PATTERN.test(slug))
    return 'От 3 до 40 символов: латинские буквы, цифры и дефис; без дефиса в начале и конце';
  if (RESERVED_SLUGS.includes(slug)) return 'Этот адрес зарезервирован системой';
  return null;
}
