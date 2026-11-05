import { expect, type Page } from '@playwright/test';

/** Демо-учётные записи мок-сервера (см. src/mocks/users.ts). */
export const IIN = { super: '850315300128', admin: '920705400239', trainer: '880425400455', learner: '951122300340' };
export const PASSWORD = 'Sanastra1';

/** Двухэтапный вход: ИИН → «Далее» → пароль → «Войти». */
export async function signIn(page: Page, iin: string, { expectSuccess = true } = {}) {
  await page.goto('/login');
  await page.getByLabel('ИИН').fill(iin);
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByLabel('Пароль').fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  if (expectSuccess) await expect(page).not.toHaveURL(/\/login/);
}
