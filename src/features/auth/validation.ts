import { z } from 'zod';

/**
 * Правила валидации регистрации и входа (ТЗ, раздел 3.3 п. 2).
 * Используются и формой, и мок-сервером — сервер повторяет все проверки.
 */

/** ИИН: строго 12 цифр и корректный контрольный разряд ИИН РК. */
export function isValidIin(value: string): boolean {
  if (!/^\d{12}$/.test(value)) return false;
  const d = [...value].map(Number);
  const sum = (weights: number[]) => weights.reduce((acc, w, i) => acc + w * d[i]!, 0) % 11;
  let check = sum([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  if (check === 10) check = sum([3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2]);
  if (check === 10) return false;
  return check === d[11];
}

/** 10 цифр номера без кода страны (+7). */
export function phoneDigits(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (value.trim().startsWith('+7') || (digits.length === 11 && /^[78]/.test(digits))) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/** Маска ввода +7 (XXX) XXX-XX-XX. */
export function formatPhone(value: string): string {
  const d = phoneDigits(value);
  if (!d) return '';
  let out = `+7 (${d.slice(0, 3)}`;
  if (d.length >= 3) out += ')';
  if (d.length > 3) out += ` ${d.slice(3, 6)}`;
  if (d.length > 6) out += `-${d.slice(6, 8)}`;
  if (d.length > 8) out += `-${d.slice(8, 10)}`;
  return out;
}

/** Телефон Казахстана: +7 7XX XXX XX XX. */
export const isValidKzPhone = (value: string) => /^7\d{9}$/.test(phoneDigits(value));

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_RULE_TEXT = 'Минимум 8 символов, хотя бы одна цифра и одна заглавная буква';
export const isValidPassword = (value: string) => value.length >= 8 && /\d/.test(value) && /[A-ZА-ЯЁӘҒҚҢӨҰҮҺІ]/.test(value);

export const MESSAGES = {
  iinRequired: 'Введите ИИН',
  iin: 'ИИН должен состоять из 12 цифр и иметь корректный контрольный разряд',
  lastName: 'Введите фамилию',
  firstName: 'Введите имя',
  region: 'Выберите область',
  phone: 'Введите номер в формате +7 (7XX) XXX-XX-XX',
  email: 'Введите корректный email, например user@domain.com',
  password: PASSWORD_RULE_TEXT,
  passwordRequired: 'Введите пароль',
};

export const iinSchema = z
  .string()
  .trim()
  .min(1, MESSAGES.iinRequired)
  .refine(isValidIin, MESSAGES.iin);

export const registerSchema = z.object({
  iin: iinSchema,
  lastName: z.string().trim().min(1, MESSAGES.lastName).max(100),
  firstName: z.string().trim().min(1, MESSAGES.firstName).max(100),
  middleName: z.string().trim().max(100),
  region: z.string().min(1, MESSAGES.region),
  phone: z.string().refine(isValidKzPhone, MESSAGES.phone),
  email: z.string().trim().regex(EMAIL_PATTERN, MESSAGES.email),
  password: z.string().refine(isValidPassword, MESSAGES.password),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;
