import { expect, test, type Page } from '@playwright/test';
import { IIN, signIn } from './auth';

/**
 * Раздел 30: панель суперадмина и кабинет организации открыты параллельно.
 * Мок-БД хранится в localStorage, поэтому обе вкладки — в одном контексте (сессии раздельные, sessionStorage).
 * С реальным бэкендом сценарий работает и в разных браузерных контекстах.
 */
const ACADEMY_ID = '7c9e6679-7425-40de-944b-000000000001';
const REALTIME_SLA = { timeout: 3_000 }; // целевое время применения — до 3 с

async function setup(page: Page) {
  const admin = page;
  const cabinet = await page.context().newPage();
  await signIn(admin, IIN.super);
  await admin.goto(`/superadmin/organizations/${ACADEMY_ID}`);
  await expect(admin.getByRole('heading', { name: 'Academy' })).toBeVisible();
  await signIn(cabinet, IIN.admin);
  await expect(cabinet.getByTestId('dashboard-hero')).toBeVisible();
  return { admin, cabinet };
}

async function adminSave(admin: Page, critical = false) {
  await admin.getByRole('button', { name: 'Сохранить', exact: true }).click();
  if (critical) await admin.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(admin.getByText('Изменения сохранены')).toBeVisible();
}

test('смена тарифа применяется в открытом кабинете за 1–3 секунды', async ({ page }) => {
  const { admin, cabinet } = await setup(page);
  await cabinet.goto('/academy/admin/organization/subscription');
  await expect(cabinet.getByTestId('tariff-name')).toHaveText('Базовый');

  await admin.getByRole('combobox', { name: 'Тарифный план' }).click();
  await admin.getByTitle('Стандарт').click();
  await admin.getByTestId('tariff-preview').getByRole('button', { name: 'Применить тариф' }).click();
  await adminSave(admin, true);

  await expect(cabinet.getByTestId('tariff-name')).toHaveText('Стандарт', REALTIME_SLA);
  await expect(cabinet.getByText('Настройки подписки обновлены')).toBeVisible();
});

test('отключение модуля: пункт меню исчезает, открытый модуль закрывается', async ({ page }) => {
  const { admin, cabinet } = await setup(page);
  await cabinet.goto('/academy/admin/m/WEBINARS');
  await expect(cabinet.getByTestId('webinars-view')).toBeVisible();

  await admin.getByLabel('Индивидуальное значение модуля «Вебинары»').getByText('Отключён').click();
  await adminSave(admin, true);

  await expect(cabinet).toHaveURL(/\/academy\/admin$/, REALTIME_SLA);
  await expect(cabinet.getByText('Доступ к модулю отключён администратором Sanastra')).toBeVisible();
  await expect(cabinet.getByRole('menuitem', { name: 'Вебинары' })).toHaveCount(0);
});

test('изменение лимита обновляет usage без перезагрузки', async ({ page }) => {
  const { admin, cabinet } = await setup(page);
  await cabinet.goto('/academy/admin/organization/usage');
  await expect(cabinet.getByTestId('usage-limit-USERS_COUNT')).toContainText('150');

  await admin.getByLabel('Индивидуальное значение: Количество пользователей').fill('200');
  await adminSave(admin);

  await expect(cabinet.getByTestId('usage-limit-USERS_COUNT')).toContainText('200', REALTIME_SLA);
});

test('отключение и восстановление подписки', async ({ page }) => {
  const { admin, cabinet } = await setup(page);

  await admin.getByRole('switch').click();
  await adminSave(admin, true);
  await expect(cabinet).toHaveURL(/subscription-blocked/, REALTIME_SLA);
  await expect(cabinet.getByText('Доступ организации временно приостановлен')).toBeVisible();

  await admin.getByRole('switch').click();
  await adminSave(admin);
  // Повторная проверка без повторного входа
  await expect(cabinet).toHaveURL(/\/academy\/admin$/, REALTIME_SLA);
});

test('SSE недоступен — polling fallback, интерфейс работает', async ({ page }) => {
  const { admin, cabinet } = await setup(page);
  await cabinet.evaluate(() => window.__mock!.setSseDisabled(true));
  await cabinet.reload();
  await expect(cabinet.getByTestId('dashboard-hero')).toBeVisible();
  const before = await cabinet.getByTestId('hero-end-date').textContent();

  // Онлайн-оплата продлевает подписку на год (SYSTEM_PAYMENT)
  await admin.evaluate(() => window.__mock!.simulatePayment('academy'));
  // fallback (2 с в E2E) + интервал polling (3 с)
  await expect(cabinet.getByTestId('hero-end-date')).not.toHaveText(before ?? '', { timeout: 12_000 });
  await cabinet.evaluate(() => window.__mock!.setSseDisabled(false));
});

test('обычный пользователь видит только доступное роли и организации', async ({ page }) => {
  await signIn(page, IIN.learner);
  await expect(page.getByRole('menuitem', { name: 'Курсы' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Пользователи' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Тариф и подписка' })).toHaveCount(0);
  await expect(page.getByText('Использование лимитов')).toHaveCount(0);
});

test('мобильный экран: меню в Drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, IIN.admin);
  await expect(page.getByRole('menuitem', { name: 'Курсы' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.getByRole('menuitem', { name: 'Курсы' }).click();
  await expect(page).toHaveURL(/\/academy\/admin\/m\/COURSES$/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
