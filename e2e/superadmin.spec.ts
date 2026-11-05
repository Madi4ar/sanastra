import { expect, test, type Page } from '@playwright/test';

const ACADEMY_ID = '7c9e6679-7425-40de-944b-000000000001';

declare global {
  interface Window {
    __mock?: { simulatePayment: (tenantIdOrSlug: string) => Promise<unknown>; setSseDisabled: (v: boolean) => void };
  }
}

async function login(page: Page, who: 'super' | 'tenant') {
  await page.goto('/login');
  await page
    .getByRole('button', {
      name: who === 'super' ? 'Войти как суперадминистратор' : 'Войти как администратор организации (academy)',
    })
    .click();
  await expect(page).not.toHaveURL(/\/login/);
}

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

test('3. Индивидуальное включение модуля и изменение лимита', async ({ page }) => {
  await openAcademy(page);
  await page.getByTestId('module-row-REPORTS').getByText('Включён').click();
  await expect(page.getByTestId('module-effective-REPORTS')).toContainText('Индивидуально');
  await page.getByLabel('Индивидуальное значение: Количество курсов').fill('25');
  await expect(page.getByText('Есть несохранённые изменения')).toBeVisible();
  await save(page).click();
  await expect(page.getByText('Изменения сохранены')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('limit-effective-COURSES_COUNT')).toContainText('25');
  await expect(page.getByTestId('module-effective-REPORTS')).toContainText('Включён');
});

test('4. Возврат override к значению тарифа', async ({ page }) => {
  await openAcademy(page);
  await expect(page.getByTestId('limit-effective-USERS_COUNT')).toContainText('150');
  await page.getByRole('button', { name: 'Вернуть значение тарифа для «Количество пользователей»' }).click();
  await expect(page.getByTestId('limit-effective-USERS_COUNT')).toContainText('50');
  await save(page).click();
  await expect(page.getByTestId('critical-changes')).toContainText('Уменьшение лимита');
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByText('Изменения сохранены')).toBeVisible();
  await expect(page.getByTestId('limit-effective-USERS_COUNT')).not.toContainText('Индивидуально');
});

test('5. Отключение подписки и блокировка tenant-интерфейса', async ({ page }) => {
  await openAcademy(page);
  await page.getByRole('switch').click();
  await save(page).click();
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByText('Изменения сохранены')).toBeVisible();
  await expect(page.getByTestId('status-tag').first()).toHaveText('Заблокирована');

  await page.getByRole('button', { name: 'Выйти' }).click();
  await login(page, 'tenant');
  await expect(page).toHaveURL(/\/academy\/subscription-blocked/);
  await expect(page.getByText('Доступ организации временно приостановлен')).toBeVisible();
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
  await expect(page.getByText(/платёжный сервис/)).toBeVisible();
});

test('7. Запрет доступа без SUPERADMIN', async ({ page }) => {
  await login(page, 'tenant');
  await expect(page).toHaveURL(/\/academy\/dashboard$/);
  await page.goto('/superadmin/organizations');
  await expect(page).toHaveURL(/\/403$/);
  await expect(page.getByText('Недостаточно прав для просмотра этой страницы.')).toBeVisible();
});

test('Feature flag: отключённый модуль скрыт из меню и защищён guard', async ({ page }) => {
  await login(page, 'tenant');
  await expect(page.getByRole('menuitem', { name: 'Вебинары' })).toBeVisible(); // включён индивидуально
  await expect(page.getByRole('menuitem', { name: 'Отчёты' })).toHaveCount(0);
  await page.goto('/academy/m/REPORTS');
  await expect(page).toHaveURL(/feature-unavailable/);
  await expect(page.getByText('Функция недоступна')).toBeVisible();
});
