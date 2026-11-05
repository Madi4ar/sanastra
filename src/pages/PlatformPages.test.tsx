import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { load } from '@/mocks/db';
import { loadUsers } from '@/mocks/users';
import { loginAs, renderApp } from '@/test/utils';

/** Строка таблицы по тексту ячейки (ФИО может встречаться и в шапке профиля). */
async function rowOf(text: string): Promise<HTMLElement> {
  let row: HTMLElement | null = null;
  await waitFor(() => {
    row = screen.getAllByText(text).map((e) => e.closest('tr')).find(Boolean) ?? null;
    expect(row).not.toBeNull();
  });
  return row!;
}

describe('Суперадмин: разделы «Тарифные планы» и «Пользователи»', () => {
  beforeEach(() => loginAs('SUPERADMIN'));

  it('пункты левого меню открывают отдельные страницы, раздела «Лимиты» нет', async () => {
    const { user, router } = renderApp('/superadmin/organizations');
    await user.click(await screen.findByRole('menuitem', { name: 'Тарифные планы' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/superadmin/tariffs'));
    expect(await screen.findByRole('heading', { name: 'Тарифные планы' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Лимиты' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Пользователи' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/superadmin/users'));
    expect(await screen.findByRole('heading', { name: 'Пользователи' })).toBeInTheDocument();
  });

  it('«Тарифные планы»: список с годовой ценой и лимитами, создание тарифа', async () => {
    const { user } = renderApp('/superadmin/tariffs');
    const basic = await screen.findByTestId('tariff-row-basic');
    expect(basic).toHaveTextContent('Базовый');
    expect(basic).toHaveTextContent(/100\s000 ₸/);
    await waitFor(() => expect(basic).toHaveTextContent('150 пользователей'));

    await user.click(await screen.findByRole('button', { name: /Создать новый тариф/ }));
    const form = await screen.findByRole('form', { name: 'Форма тарифа' });
    await user.type(within(form).getByLabelText(/Название тарифа/), 'Премиум');
    await user.type(within(form).getByLabelText(/Системный код/), 'premium');
    await user.type(within(form).getByLabelText(/Годовая цена/), '500000');
    const users = within(form).getByLabelText(/Количество пользователей/);
    await user.clear(users);
    await user.type(users, '20000');
    expect(await within(form).findByText(/^Максимум — 10\s000$/)).toBeInTheDocument();
    await user.clear(users);
    await user.type(users, '2000');
    await user.click(within(form).getByRole('switch', { name: 'Модуль «Вебинары»' }));
    expect(within(form).getByRole('switch', { name: 'Модуль «Пользователи»' })).toBeDisabled();
    await user.click(within(form).getByRole('button', { name: 'Сохранить тариф' }));

    expect(await screen.findByText('Тариф создан')).toBeInTheDocument();
    const created = load().tariffs.find((t) => t.code === 'premium')!;
    expect(created).toMatchObject({ name: 'Премиум', annualPrice: 500_000 });
    expect(created.limits.USERS_COUNT).toBe(2000);
    expect(created.modules).toMatchObject({ USERS: true, WEBINARS: true, CHAT: false });
    expect(await screen.findByTestId('tariff-row-premium')).toBeInTheDocument();
  });

  it('редактирование цены тарифа не меняет условия оформленных периодов', async () => {
    const { user } = renderApp('/superadmin/tariffs');
    await user.click(await screen.findByRole('button', { name: 'Редактировать тариф «Базовый»' }));
    const form = await screen.findByRole('form', { name: 'Форма тарифа' });
    const price = within(form).getByLabelText(/Годовая цена/);
    await waitFor(() => expect(price).toHaveValue('100000'));
    await user.clear(price);
    await user.type(price, '120000');
    await user.click(within(form).getByRole('button', { name: 'Сохранить тариф' }));
    expect(await screen.findByText('Тариф сохранён')).toBeInTheDocument();
    expect(load().tariffs[0]!.annualPrice).toBe(120_000);
    const academy = load().organizations[0]!;
    expect(academy.annualPrice).toBe(100_000);
    expect(academy.history.every((h) => h.basePrice === 100_000)).toBe(true);
  });

  it('«Пользователи»: роли с организациями, назначение роли из строки пользователя', async () => {
    const { user } = renderApp('/superadmin/users');
    const row = await rowOf('Сапарова Алия Маратовна');
    expect(within(row).getByText('Администратор организации · Academy')).toBeInTheDocument();

    const learner = await rowOf('Ахметов Данияр');
    await user.click(within(learner).getByRole('button', { name: 'Назначить роль: Ахметов Данияр' }));
    expect(await screen.findByLabelText(/ИИН пользователя/)).toHaveValue('951122300340');
    await user.type(screen.getByLabelText(/Организация/), 'Academy');
    await user.click(await screen.findByTitle('Academy'));
    await user.click(screen.getByLabelText(/^Роль/));
    await user.click(await screen.findByTitle('Тренер'));
    await user.click(screen.getByRole('button', { name: 'Назначить' }));

    expect(await within(await rowOf('Ахметов Данияр')).findByText('Тренер · Academy')).toBeInTheDocument();
    expect(loadUsers().find((u) => u.iin === '951122300340')!.roles).toContainEqual({ role: 'TRAINER', clientSlug: 'academy' });
  });

  it('создание пользователя: валидация и роль «Слушатель»', async () => {
    const { user } = renderApp('/superadmin/users');
    await user.click(await screen.findByRole('button', { name: /Создать пользователя/ }));
    const form = await screen.findByRole('form', { name: 'Новый пользователь' });
    const fill = async (label: RegExp, text: string) => {
      await user.click(within(form).getByLabelText(label));
      await user.paste(text);
    };
    await fill(/ИИН/, '920705400239'); // уже зарегистрирован
    await fill(/Фамилия/, 'Иванов');
    await fill(/^Имя/, 'Иван');
    await user.type(within(form).getByLabelText(/Область/), 'Алматы');
    await user.click(await screen.findByTitle('г. Алматы'));
    await fill(/Телефон/, '7071234567');
    await fill(/Email/, 'ivanov@mail.kz');
    await fill(/Пароль/, 'Secret123');
    await user.click(screen.getByRole('button', { name: /Создать$/ }));
    expect(await within(form).findByText('Пользователь с таким ИИН уже зарегистрирован')).toBeInTheDocument();

    await user.clear(within(form).getByLabelText(/ИИН/));
    await fill(/ИИН/, '990101500561');
    await user.click(screen.getByRole('button', { name: /Создать$/ }));
    expect(await screen.findByText('Пользователь создан: Иванов Иван')).toBeInTheDocument();
    const created = loadUsers().find((u) => u.iin === '990101500561')!;
    expect(created).toMatchObject({ email: 'ivanov@mail.kz', phone: '7071234567', roles: [{ role: 'LEARNER' }] });
    expect(await within(await rowOf('Иванов Иван')).findByText('Слушатель')).toBeInTheDocument();
  });

  it('редактирование пользователя: данные и снятие роли', async () => {
    const { user } = renderApp('/superadmin/users');
    const row = await rowOf('Нурланова Айгерим');
    await user.click(within(row).getByRole('button', { name: 'Редактировать: Нурланова Айгерим' }));
    const form = await screen.findByRole('form', { name: 'Редактирование пользователя' });
    const email = within(form).getByLabelText(/Email/);
    expect(email).toHaveValue('trainer@academy.kz');
    await user.clear(email);
    await user.paste('aigerim@academy.kz');
    const trainerTag = within(within(form).getByTestId('user-roles')).getByText(/Тренер · Academy/).closest('.ant-tag')!;
    await user.click(trainerTag.querySelector('.ant-tag-close-icon')!);
    await user.click(screen.getByRole('button', { name: /^Сохранить$/ }));

    expect(await screen.findByText('Изменения сохранены: Нурланова Айгерим')).toBeInTheDocument();
    const updated = loadUsers().find((u) => u.iin === '880425400455')!;
    expect(updated.email).toBe('aigerim@academy.kz');
    expect(updated.roles).toEqual([{ role: 'LEARNER' }]);
  });

  it('удаление пользователя с подтверждением; себя удалить нельзя', async () => {
    const { user } = renderApp('/superadmin/users');
    const self = await rowOf('Касымов Нурлан');
    expect(within(self).getByRole('button', { name: 'Нельзя удалить собственную учётную запись' })).toBeDisabled();

    const row = await rowOf('Ахметов Данияр');
    await user.click(within(row).getByRole('button', { name: 'Удалить: Ахметов Данияр' }));
    expect(await screen.findByText('Удалить пользователя?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Удалить$/ }));
    expect(await screen.findByText('Пользователь удалён: Ахметов Данияр')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Ахметов Данияр')).not.toBeInTheDocument());
    expect(loadUsers().some((u) => u.iin === '951122300340')).toBe(false);
  });
});
