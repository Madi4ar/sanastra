import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '@/test/setup';
import { loginAs, renderApp } from '@/test/utils';

const rows = () => screen.getAllByRole('row').filter((r) => r.classList.contains('clickable-row'));

describe('Реестр организаций', () => {
  beforeEach(() => loginAs('SUPERADMIN'));

  it('показывает таблицу с колонками и пагинацию по 20', async () => {
    renderApp('/superadmin/organizations');
    expect(await screen.findByTestId('table-skeleton')).toBeInTheDocument();
    expect(await screen.findByText('Academy')).toBeInTheDocument();
    ['Организация', 'Slug', 'Тариф', 'Статус', 'Начало', 'Окончание', 'Модули', 'Создана', 'Действия'].forEach((h) =>
      expect(screen.getAllByText(h).length).toBeGreaterThan(0),
    );
    expect(rows()).toHaveLength(20);
    expect(screen.getByText('1–20 из 35')).toBeInTheDocument();
  });

  it('поиск с debounce синхронизируется с URL', async () => {
    const { user, router } = renderApp('/superadmin/organizations');
    await screen.findByText('Academy');
    await user.type(screen.getByLabelText('Поиск по названию или slug'), 'pixel');
    await waitFor(() => expect(router.state.location.search).toContain('search=pixel'), { timeout: 2000 });
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.getByText('Школа дизайна Pixel')).toBeInTheDocument();
    expect(router.state.location.search).toContain('page=1');
  });

  it('читает фильтры из URL и показывает «ничего не найдено» со сбросом', async () => {
    const { user, router } = renderApp('/superadmin/organizations?search=zzz-нет-такой&status=ACTIVE');
    expect(await screen.findByText('Ничего не найдено по заданным условиям')).toBeInTheDocument();
    const resetButtons = screen.getAllByRole('button', { name: /Сбросить фильтры/ });
    await user.click(resetButtons[0]!);
    await waitFor(() => expect(router.state.location.search).not.toContain('search'));
    expect(await screen.findByText('Academy')).toBeInTheDocument();
    expect(screen.getByLabelText('Поиск по названию или slug')).toHaveValue('');
  });

  it('фильтр статуса из URL применяется на сервере', async () => {
    renderApp('/superadmin/organizations?status=EXPIRED');
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    rows().forEach((r) => expect(within(r).getByTestId('status-tag')).toHaveTextContent('Истекла'));
  });

  it('пагинация переключает страницу и пишет её в URL', async () => {
    const { user, router } = renderApp('/superadmin/organizations');
    await screen.findByText('Academy');
    await user.click(screen.getByRole('button', { name: 'Страница 2' }));
    await waitFor(() => expect(router.state.location.search).toContain('page=2'));
    await waitFor(() => expect(rows()).toHaveLength(15));
  });

  it('клик по строке открывает карточку', async () => {
    const { user, router } = renderApp('/superadmin/organizations');
    await user.click(await screen.findByText('Academy'));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/superadmin\/organizations\/7c9e/));
  });

  it('ошибка 500: сообщение без технических деталей и кнопка «Повторить»', async () => {
    let fail = true;
    server.use(
      http.get('/api/superadmin/organizations', () =>
        fail ? HttpResponse.json({ message: 'NullPointerException at Foo.java:42' }, { status: 500 }) : undefined,
      ),
    );
    const { user } = renderApp('/superadmin/organizations');
    expect(await screen.findByText('Не удалось загрузить данные')).toBeInTheDocument();
    expect(screen.queryByText(/NullPointerException/)).not.toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: /Повторить/ }));
    expect(await screen.findByText('Academy')).toBeInTheDocument();
  });

  it('пустой реестр', async () => {
    server.use(
      http.get('/api/superadmin/organizations', () =>
        HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 }),
      ),
    );
    renderApp('/superadmin/organizations');
    expect(await screen.findByText('Организаций пока нет')).toBeInTheDocument();
  });
});

describe('Доступ', () => {
  it('неавторизованный пользователь перенаправляется на вход', async () => {
    loginAs(null);
    const { router } = renderApp('/superadmin/organizations');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toContain('redirect=');
  });

  it('пользователь без роли SUPERADMIN получает 403', async () => {
    loginAs('ORGANIZATION_ADMIN');
    const { router } = renderApp('/superadmin/organizations');
    await waitFor(() => expect(router.state.location.pathname).toBe('/403'));
    expect(await screen.findByText('Недостаточно прав для просмотра этой страницы.')).toBeInTheDocument();
  });

  it('неизвестный маршрут — 404', async () => {
    loginAs('SUPERADMIN');
    renderApp('/superadmin/unknown/page');
    expect(await screen.findByText('Страница не найдена.')).toBeInTheDocument();
  });
});

describe('Создание организации', () => {
  beforeEach(() => loginAs('SUPERADMIN'));

  it('адрес генерируется из названия (с транслитерацией), после создания открывается карточка', async () => {
    const { user, router } = renderApp('/superadmin/organizations');
    await screen.findByText('Academy');
    await user.click(screen.getByRole('button', { name: /Создать организацию/ }));
    await user.click(await screen.findByLabelText(/^Название/));
    await user.paste('Қазақ тілі орталығы');
    expect(screen.getByLabelText(/Адрес кабинета/)).toHaveValue('qazaq-tili-ortalygy');
    expect(await screen.findByText('Адрес свободен', {}, { timeout: 3000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Создать' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Создать' }));

    expect(await screen.findByText('Организация «Қазақ тілі орталығы» создана')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/superadmin\/organizations\/[0-9a-f-]{36}$/));
    expect(await screen.findByRole('heading', { name: 'Қазақ тілі орталығы' })).toBeInTheDocument();
  });

  it('занятый адрес и невалидные данные не позволяют создать организацию', async () => {
    const { user } = renderApp('/superadmin/organizations');
    await screen.findByText('Academy');
    await user.click(screen.getByRole('button', { name: /Создать организацию/ }));
    await user.click(await screen.findByLabelText(/^Название/));
    await user.paste('Новая школа');
    const slug = screen.getByLabelText(/Адрес кабинета/);
    await user.clear(slug);
    await user.paste('academy');
    expect(await screen.findByText('Этот адрес уже занят', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Создать' })).toBeDisabled();

    await user.clear(slug);
    await user.paste('-x');
    expect(await screen.findByText(/От 3 до 40 символов/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Создать' })).toBeDisabled();
  });
});
