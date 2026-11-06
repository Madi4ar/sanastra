import { expect, test, type Page } from '@playwright/test';
import { IIN, signIn } from './auth';

const ACADEMY_ID = '7c9e6679-7425-40de-944b-000000000001';

declare global {
  interface Window {
    __mock?: { simulatePayment: (tenantIdOrSlug: string) => Promise<unknown>; setSseDisabled: (v: boolean) => void };
  }
}

const login = (page: Page, who: 'super' | 'tenant') => signIn(page, who === 'super' ? IIN.super : IIN.admin);

async function openAcademy(page: Page) {
  await login(page, 'super');
  await page.goto(`/superadmin/organizations/${ACADEMY_ID}`);
  await expect(page.getByRole('heading', { name: 'Academy' })).toBeVisible();
}

const save = (page: Page) => page.getByRole('button', { name: 'Сохранить', exact: true });

test('1. Поиск организации и открытие карточки', async ({ page }) => {
  await login(page, 'super');
  await expect(page).toHaveURL(/\/superadmin\/organizations/);
  await page.getByPlaceholder('Поиск по названию или slug').fill('robo');
  await expect(page).toHaveURL(/search=robo/);
  const row = page.locator('tr.clickable-row');
  await expect(row).toHaveCount(1);
  await row.click();
  await expect(page.getByRole('heading', { name: 'Академия робототехники' })).toBeVisible();
  await page.getByRole('button', { name: 'Назад к реестру' }).click();
  await expect(page).toHaveURL(/search=robo/);
});

test('2. Смена тарифа с preview и подтверждением', async ({ page }) => {
  await openAcademy(page);
  await page.getByRole('combobox', { name: 'Тарифный план' }).click();
  await page.getByTitle('Стандарт').click();
  const preview = page.getByTestId('tariff-preview');
  await expect(preview).toContainText('Базовый');
  await expect(preview).toContainText('Стандарт');
  await preview.getByText('Сбросить все индивидуальные настройки', { exact: false }).click();
  await preview.getByRole('button', { name: 'Применить тариф' }).click();
  await expect(page.getByText('Будет изменён с «Базовый» после сохранения')).toBeVisible();
  await save(page).click();
  await expect(page.getByTestId('critical-changes')).toContainText('Смена тарифа: «Базовый» → «Стандарт»');
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByText('Изменения сохранены')).toBeVisible();
  await expect(page.getByText('Тариф: Стандарт')).toBeVisible();
});

test('3. Индивидуальное включение модуля и ручная скидка', async ({ page }) => {
  await openAcademy(page);
  await page.getByTestId('module-row-REPORTS').getByText('Включён').click();
  await expect(page.getByTestId('module-effective-REPORTS')).toContainText('Индивидуально');
  await page.getByLabel('Ручная скидка').fill('20000');
  await expect(page.getByTestId('final-price')).toContainText(/80\s000 ₸/);
  await expect(page.getByText('Есть несохранённые изменения')).toBeVisible();
  await save(page).click();
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByText('Изменения сохранены')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('module-effective-REPORTS')).toContainText('Включён');
  await expect(page.getByTestId('history-row-ACTIVE')).toContainText('Изменение условий');
});

test('4. Продление подписки и история периодов', async ({ page }) => {
  await openAcademy(page);
  await expect(page.getByTestId('limits-section')).toHaveCount(0);
  await page.getByRole('button', { name: /Продлить подписку/ }).click();
  await save(page).click();
  await expect(page.getByText('Изменения сохранены')).toBeVisible();
  await expect(page.getByTestId('history-row-ACTIVE')).toHaveCount(1);
  await expect(page.getByTestId('history-row-ACTIVE')).toContainText('Продление');
  await expect(page.getByTestId('org-usage-USERS_COUNT')).toContainText('Осталось');
});

test('5. Отключение подписки и блокировка tenant-интерфейса', async ({ page }) => {
  await openAcademy(page);
  await page.getByRole('switch').click();
  await save(page).click();
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByText('Изменения сохранены')).toBeVisible();
  await expect(page.getByTestId('status-tag').first()).toHaveText('Заблокирована');

  await page.getByRole('button', { name: 'Выйти' }).click();
  // Вход пользователей заблокированной организации блокируется на этапе авторизации
  await signIn(page, IIN.learner, { expectSuccess: false });
  await expect(page.getByText('Вход невозможен: организация заблокирована или срок её подписки истёк.')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(ACADEMY_ID)).toHaveCount(0);
});

test('6. Конфликт версий после внешнего изменения', async ({ page }) => {
  await openAcademy(page);
  await page.getByTestId('module-row-CHAT').getByText('Включён').click();
  // Платёжный сервис продлевает подписку в фоне
  await page.evaluate(() => window.__mock!.simulatePayment('academy'));
  await save(page).click();
  await expect(page.getByText('Конфликт версий')).toBeVisible();
  await page.getByRole('button', { name: 'Загрузить актуальные данные' }).click();
  await expect(page.getByText('Изменений нет')).toBeVisible();
  await expect(page.getByText(/обновлено .*платёжный сервис/)).toBeVisible();
  // Оплата из ЛК клиента тоже фиксируется в истории подписки
  await expect(page.getByTestId('history-row-ACTIVE')).toContainText('Продление · платёжный сервис');
});

test('7. Запрет доступа без SUPERADMIN', async ({ page }) => {
  await login(page, 'tenant');
  await expect(page).toHaveURL(/\/academy\/admin$/);
  await page.goto('/superadmin/organizations');
  await expect(page).toHaveURL(/\/403$/);
  await expect(page.getByText('Недостаточно прав для просмотра этой страницы.')).toBeVisible();
});

test('Демо-модули: скрытый из меню закрытый модуль предлагает перейти на другой тариф', async ({ page }) => {
  await login(page, 'tenant');
  await expect(page.getByRole('menuitem', { name: 'Вебинары' })).toHaveCount(0); // страница временно скрыта
  await expect(page.getByRole('menuitem', { name: /Конструктор отчётов/ })).toHaveCount(0);
  await page.goto('/academy/admin/m/REPORTS');
  await expect(page.getByTestId('promo-REPORTS')).toContainText('Демо / Доступно в тарифе Стандарт');
  await expect(page.getByRole('button', { name: 'Перейти на тариф Стандарт' })).toBeVisible();
});
