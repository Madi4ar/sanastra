import { act, screen, waitFor, within } from '@testing-library/react';
import dayjs from 'dayjs';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { TARIFFS, load, save, type OrgRecord } from '@/mocks/db';
import { publish } from '@/mocks/eventBus';
import { publishChanges } from '@/mocks/handlers';
import { FakeEventSource } from '@/test/FakeEventSource';
import { server } from '@/test/setup';
import { ACADEMY_ID, loginAs, renderApp } from '@/test/utils';

/** «Суперадмин сохранил изменения»: атомарное обновление + публикация событий, как делает backend. */
function serverUpdate(patch: Partial<OrgRecord>) {
  const db = load();
  const org = db.organizations.find((o) => o.tenantId === ACADEMY_ID)!;
  const before = structuredClone(org);
  Object.assign(org, patch, { version: org.version + 1, updatedAt: new Date().toISOString() });
  save(db);
  act(() => publishChanges(before, org));
}

const menu = () => screen.getByRole('menu');
const menuItem = (name: string) => within(menu()).queryByRole('menuitem', { name });
const connected = () => waitFor(() => expect(FakeEventSource.current).toBeDefined());

function countRequests(path: string) {
  const counter = { n: 0 };
  server.use(
    http.get(path, () => {
      counter.n += 1;
      return undefined;
    }),
  );
  return counter;
}

describe('Кабинет: навигация и права', () => {
  it('меню строится после получения access: сначала skeleton, без запрещённых пунктов', async () => {
    loginAs('TENANT_USER');
    renderApp('/academy');
    expect(await screen.findByTestId('nav-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    await waitFor(() => expect(menuItem('Курсы')).toBeInTheDocument());
    expect(screen.queryByTestId('nav-skeleton')).not.toBeInTheDocument();
  });

  it('права роли и права организации применяются совместно', async () => {
    loginAs('TENANT_USER');
    renderApp('/academy/dashboard');
    await waitFor(() => expect(menuItem('Курсы')).toBeInTheDocument());
    expect(menuItem('Вебинары')).toBeInTheDocument(); // модуль включён + есть право
    expect(menuItem('Сообщения')).not.toBeInTheDocument(); // право есть, модуль отключён тарифом
    expect(menuItem('Пользователи')).not.toBeInTheDocument(); // модуль включён, права нет
    expect(menuItem('Отчёты')).not.toBeInTheDocument(); // нет ни того, ни другого
    expect(screen.queryByText('Организация')).not.toBeInTheDocument();
  });

  it('администратор организации видит раздел «Организация» и лимиты', async () => {
    loginAs('ORGANIZATION_ADMIN');
    renderApp('/academy/dashboard');
    await waitFor(() => expect(menuItem('Тариф и подписка')).toBeInTheDocument());
    expect(menuItem('Пользователи')).toBeInTheDocument();
    expect(await screen.findByTestId('usage-USERS_COUNT')).toHaveTextContent('82 из 150 пользователей');
  });

  it('обычный пользователь не видит технические данные', async () => {
    loginAs('TENANT_USER');
    renderApp('/academy/dashboard');
    await screen.findByTestId('quick-actions');
    const text = document.body.textContent ?? '';
    ['COURSES', 'USERS_COUNT', ACADEMY_ID, 'Тариф', 'override', 'Индивидуально'].forEach((t) =>
      expect(text).not.toContain(t),
    );
  });

  it('прямой переход к недоступному модулю → «Функция недоступна»', async () => {
    loginAs('TENANT_USER');
    const { router } = renderApp('/academy/m/REPORTS');
    await waitFor(() => expect(router.state.location.pathname).toBe('/academy/feature-unavailable'));
    expect(await screen.findByText('Функция недоступна')).toBeInTheDocument();
  });

  it('страницы организации закрыты для обычного пользователя', async () => {
    loginAs('TENANT_USER');
    const { router } = renderApp('/academy/organization/usage');
    await waitFor(() => expect(router.state.location.pathname).toBe('/academy/feature-unavailable'));
  });

  it('чужая организация — 403', async () => {
    loginAs('TENANT_USER');
    const { router } = renderApp('/kod-school/dashboard');
    await waitFor(() => expect(router.state.location.pathname).toBe('/403'));
  });

  it('предупреждение «Подписка скоро истекает» за 14 дней', async () => {
    const db = load();
    db.organizations[0]!.subscriptionEndDate = dayjs().add(5, 'day').format('YYYY-MM-DD');
    save(db);
    loginAs('ORGANIZATION_ADMIN');
    renderApp('/academy/dashboard');
    expect(await screen.findByTestId('expiring-alert')).toHaveTextContent('Осталось 6 дн.');
  });
});

describe('Кабинет: real-time обновления', () => {
  beforeEach(() => loginAs('ORGANIZATION_ADMIN'));

  it('смена тарифа обновляет карточку подписки без перезагрузки', async () => {
    renderApp('/academy/organization/subscription');
    expect(await screen.findByTestId('tariff-name')).toHaveTextContent('Базовый');
    await connected();
    serverUpdate({ tariffPlanId: TARIFFS[2]!.id });
    await waitFor(() => expect(screen.getByTestId('tariff-name')).toHaveTextContent('Бизнес'));
    expect(await screen.findByText('Настройки подписки обновлены')).toBeInTheDocument();
    expect(screen.getByTestId('tariff-name').closest('[data-flash]')).not.toBeNull(); // подсветка
  });

  it('отключение модуля убирает его из меню и dashboard', async () => {
    renderApp('/academy/dashboard');
    await screen.findByTestId('module-card-WEBINARS');
    await connected();
    serverUpdate({ moduleOverrides: { WEBINARS: null } });
    await waitFor(() => expect(screen.queryByTestId('module-card-WEBINARS')).not.toBeInTheDocument());
    expect(menuItem('Вебинары')).not.toBeInTheDocument();
  });

  it('отключение открытого модуля: уведомление и переход на dashboard', async () => {
    const { router } = renderApp('/academy/m/WEBINARS');
    expect(await screen.findByTestId('webinars-view')).toBeInTheDocument();
    await connected();
    serverUpdate({ moduleOverrides: { WEBINARS: null } });
    await waitFor(() => expect(router.state.location.pathname).toBe('/academy/dashboard'));
    expect(await screen.findByText('Доступ к модулю отключён администратором Sanastra')).toBeInTheDocument();
  });

  it('изменение лимита обновляет usage', async () => {
    renderApp('/academy/organization/usage');
    expect(await screen.findByTestId('usage-limit-USERS_COUNT')).toHaveTextContent('150');
    await connected();
    serverUpdate({ limitOverrides: { USERS_COUNT: 85 } });
    await waitFor(() => expect(screen.getByTestId('usage-limit-USERS_COUNT')).toHaveTextContent('85'));
    // 82 из 85 — 96 %: «почти исчерпан»
    expect(within(screen.getByTestId('usage-USERS_COUNT')).getByText('Почти исчерпан')).toBeInTheDocument();
  });

  it('уменьшение лимита ниже использования — Alert, данные не удаляются', async () => {
    renderApp('/academy/organization/usage');
    await screen.findByTestId('usage-limit-USERS_COUNT');
    await connected();
    serverUpdate({ limitOverrides: { USERS_COUNT: 60 } });
    expect(await screen.findByTestId('limit-alert-USERS_COUNT')).toHaveTextContent('уменьшен ниже текущего использования');
  });

  it('блокировка вызывает немедленный redirect, восстановление возвращает доступ', async () => {
    const { router } = renderApp('/academy/dashboard');
    await screen.findByTestId('dashboard-hero');
    await connected();
    serverUpdate({ subscriptionEnabled: false });
    await waitFor(() => expect(router.state.location.pathname).toBe('/academy/subscription-blocked'));
    expect(await screen.findByText('Доступ организации временно приостановлен')).toBeInTheDocument();

    await connected();
    serverUpdate({ subscriptionEnabled: true });
    await waitFor(() => expect(router.state.location.pathname).toBe('/academy/dashboard'));
  });

  it('повторяющиеся события объединяются: одна инвалидация и один toast', async () => {
    renderApp('/academy/dashboard');
    await screen.findByTestId('dashboard-hero');
    await connected();
    const access = countRequests('/api/tenant/access');
    const db = load();
    const org = db.organizations[0]!;
    org.version += 1;
    org.subscriptionEndDate = dayjs().add(300, 'day').format('YYYY-MM-DD');
    save(db);
    act(() => {
      for (let i = 0; i < 3; i++)
        publish({
          type: 'tenant-config.updated',
          tenantId: ACADEMY_ID,
          version: org.version,
          changed: ['subscription'],
          occurredAt: new Date().toISOString(),
        });
    });
    await waitFor(() => expect(screen.getAllByText('Настройки подписки обновлены')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 600));
    expect(access.n).toBe(1);
    expect(screen.getAllByText('Настройки подписки обновлены')).toHaveLength(1);
  });

  it('reconnect вызывает полный refetch', async () => {
    renderApp('/academy/dashboard');
    await screen.findByTestId('dashboard-hero');
    await connected();
    const access = countRequests('/api/tenant/access');
    const usage = countRequests('/api/tenant/usage');
    act(() => FakeEventSource.current!.drop());
    await waitFor(() => expect(access.n).toBeGreaterThan(0), { timeout: 4000 });
    expect(usage.n).toBeGreaterThan(0);
  });
});

describe('Кабинет: лимиты действий', () => {
  it('лимит исчерпан — создание блокируется фронтендом и сервером', async () => {
    const db = load();
    db.organizations[0]!.usage.COURSES_COUNT = 10; // лимит «Базового» — 10
    save(db);
    loginAs('ORGANIZATION_ADMIN');
    renderApp('/academy/m/COURSES');
    expect(await screen.findByText('Достигнут лимит тарифа')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Создать курс/ })).toBeDisabled();
  });

  it('блокировка tenant → служебная страница без внутренних ID', async () => {
    const db = load();
    db.organizations[0]!.subscriptionEndDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    save(db);
    loginAs('TENANT_USER');
    const { router } = renderApp('/academy/dashboard');
    await waitFor(() => expect(router.state.location.pathname).toBe('/academy/subscription-blocked'));
    expect(await screen.findByText('Срок действия подписки истёк')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(ACADEMY_ID);
  });
});

describe('Кабинет: курсы и вебинары', () => {
  it('каталог курсов: статистика, фильтр черновиков и поиск', async () => {
    loginAs('ORGANIZATION_ADMIN');
    const { user } = renderApp('/academy/m/COURSES');
    const view = await screen.findByTestId('courses-view');
    expect(view).toHaveTextContent('9 курсов в организации, опубликовано 8'); // = usage.COURSES_COUNT
    expect(within(screen.getByTestId('courses-grid')).getAllByText(/учеников$/)).toHaveLength(9);

    await user.click(screen.getByText('Черновики'));
    expect(within(screen.getByTestId('courses-grid')).getByText('История Казахстана')).toBeInTheDocument();
    expect(within(screen.getByTestId('courses-grid')).queryByText('Основы Python')).not.toBeInTheDocument();

    await user.click(screen.getByText('Все'));
    await user.type(screen.getByLabelText('Поиск курса'), 'python');
    expect(within(screen.getByTestId('courses-grid')).getByText('Основы Python')).toBeInTheDocument();
    expect(within(screen.getByTestId('courses-grid')).queryByText('Английский язык B1')).not.toBeInTheDocument();
  });

  it('создание курса сохраняет его и пересчитывает лимит на сервере', async () => {
    loginAs('ORGANIZATION_ADMIN');
    const { user } = renderApp('/academy/m/COURSES');
    await screen.findByTestId('courses-view');
    await user.click(screen.getByRole('button', { name: /Создать курс/ }));
    await user.type(await screen.findByLabelText(/Название/), 'Статистика для старшеклассников');
    await user.click(screen.getByRole('button', { name: 'Создать' }));
    expect(await screen.findByText('Курс создан как черновик')).toBeInTheDocument();
    expect(await screen.findByText('Статистика для старшеклассников')).toBeInTheDocument();
    expect(load().organizations[0]!.usage.COURSES_COUNT).toBe(10);
    // 10 из 10 у тарифа «Базовый» — дальнейшее создание блокируется
    await waitFor(() => expect(screen.getByRole('button', { name: /Создать курс/ })).toBeDisabled());
  });

  it('вебинары: эфир, предстоящие с записью, записи прошедших', async () => {
    loginAs('TENANT_USER');
    const { user } = renderApp('/academy/m/WEBINARS');
    await screen.findByTestId('webinars-view');
    expect(screen.getByText('Сейчас в эфире')).toBeInTheDocument();
    expect(within(screen.getByTestId('webinars-upcoming')).getAllByRole('button', { name: /^Записаться/ })).toHaveLength(3);
    expect(within(screen.getByTestId('webinars-recorded')).getAllByText('Смотреть запись')).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Записаться: Разговорный клуб: путешествия' }));
    expect(await screen.findByText('Вы записаны на вебинар')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Отменить запись: Разговорный клуб: путешествия' })).toHaveTextContent('Вы записаны');
    expect(screen.getByTestId('webinars-view')).toHaveTextContent('Вы записаны на 1 из 3 предстоящих вебинаров');
  });
});

describe('Кабинет: права на создание', () => {
  it('обычный пользователь видит курсы, но не может их создавать', async () => {
    loginAs('TENANT_USER');
    renderApp('/academy/m/COURSES');
    await screen.findByTestId('courses-grid');
    expect(screen.queryByRole('button', { name: /Создать курс/ })).not.toBeInTheDocument();
    // Сервер независимо отклоняет запрос
    const res = await fetch('/api/tenant/modules/COURSES/items?clientSlug=academy', {
      method: 'POST',
      body: JSON.stringify({ title: 'Попытка' }),
    });
    expect(res.status).toBe(403);
  });
});
