import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { isValidIin } from '@/features/auth/validation';
import { loadUsers } from '@/mocks/users';
import { ACADEMY_ID, loginAs, mutateOrg, renderApp } from '@/test/utils';

const IIN = { super: '850315300128', admin: '920705400239', learner: '951122300340', trainer: '880425400455' };
const PASSWORD = 'Sanastra1';

type User = ReturnType<typeof renderApp>['user'];

async function enterIin(user: User, iin: string) {
  await user.type(await screen.findByLabelText('ИИН'), iin);
  await user.click(screen.getByRole('button', { name: /Далее/ }));
}

async function login(user: User, iin: string, password = PASSWORD) {
  await enterIin(user, iin);
  const field = await screen.findByLabelText('Пароль');
  await user.clear(field);
  await user.type(field, password);
  await user.click(screen.getByRole('button', { name: /Войти/ }));
}

describe('Авторизация по ИИН', () => {
  it('ИИН не найден: сообщение и переход на регистрацию', async () => {
    const { user, router } = renderApp('/login');
    await enterIin(user, '990101500561');
    expect(await screen.findByText('Пользователь с таким ИИН не найден. Пожалуйста, зарегистрируйтесь')).toBeInTheDocument();
    expect(screen.queryByLabelText('Пароль')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/register'));
  });

  it.each([
    ['super', '/superadmin/organizations'],
    ['admin', '/academy/admin'],
    ['trainer', '/trainer'],
    ['learner', '/learn'],
  ] as const)('ИИН найден → пароль → интерфейс роли (%s)', async (who, path) => {
    const { user, router } = renderApp('/login');
    await login(user, IIN[who]);
    await waitFor(() => expect(router.state.location.pathname).toBe(path));
  });

  it('5 неверных паролей подряд блокируют вход на 15 минут', async () => {
    const { user } = renderApp('/login');
    await login(user, IIN.learner, 'Wrong1234');
    expect(await screen.findByText('Неверный пароль')).toBeInTheDocument();
    for (let i = 0; i < 4; i += 1) {
      await user.clear(screen.getByLabelText('Пароль'));
      await user.type(screen.getByLabelText('Пароль'), 'Wrong1234');
      await user.click(screen.getByRole('button', { name: /Войти/ }));
    }
    expect(await screen.findByText(/Аккаунт временно заблокирован.*15 мин/)).toBeInTheDocument();
    // Даже верный пароль не принимается до окончания блокировки
    await user.clear(screen.getByLabelText('Пароль'));
    await user.type(screen.getByLabelText('Пароль'), PASSWORD);
    await user.click(screen.getByRole('button', { name: /Войти/ }));
    expect(await screen.findByText(/Аккаунт временно заблокирован/)).toBeInTheDocument();
    expect(loadUsers().find((u) => u.iin === IIN.learner)!.lockedUntil).toBeTruthy();
  });

  it('организация заблокирована — вход её пользователей блокируется', async () => {
    mutateOrg(ACADEMY_ID, { subscriptionEnabled: false });
    const { user, router } = renderApp('/login');
    await login(user, IIN.learner);
    expect(await screen.findByText('Вход невозможен: организация заблокирована или срок её подписки истёк.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('несколько ролей: вход в кабинет с наивысшими правами и смена роли в шапке профиля', async () => {
    const { user, router } = renderApp('/login');
    await login(user, IIN.admin);
    await waitFor(() => expect(router.state.location.pathname).toBe('/academy/admin'));
    await user.click(await screen.findByRole('button', { name: 'Меню профиля' }));
    await user.click(await screen.findByText('Слушатель'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/learn/profile'));
  });
});

describe('Регистрация', () => {
  it('валидирует поля по правилам ТЗ', async () => {
    const { user } = renderApp('/register');
    await user.type(await screen.findByLabelText(/ИИН/), '123456789012');
    await user.type(screen.getByLabelText(/Телефон/), '6011234567');
    await user.type(screen.getByLabelText(/Email/), 'user@domain');
    await user.type(screen.getByLabelText(/Пароль/), 'password');
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
    expect(await screen.findByText('ИИН должен состоять из 12 цифр и иметь корректный контрольный разряд')).toBeInTheDocument();
    expect(screen.getByText('Введите фамилию')).toBeInTheDocument();
    expect(screen.getByText('Введите имя')).toBeInTheDocument();
    expect(screen.getAllByRole('alert').some((a) => a.textContent === 'Выберите область')).toBe(true);
    expect(screen.getByText('Введите номер в формате +7 (7XX) XXX-XX-XX')).toBeInTheDocument();
    expect(screen.getByText('Введите корректный email, например user@domain.com')).toBeInTheDocument();
    expect(screen.getByText('Минимум 8 символов, хотя бы одна цифра и одна заглавная буква')).toHaveAttribute('role', 'alert');
  });

  it('маска телефона и проверка контрольного разряда ИИН', async () => {
    expect(isValidIin('850315300128')).toBe(true);
    expect(isValidIin('850315300129')).toBe(false);
    const { user } = renderApp('/register');
    const phone = await screen.findByLabelText(/Телефон/);
    await user.type(phone, '7011234567');
    expect(phone).toHaveValue('+7 (701) 123-45-67');
  });

  it('ИИН и email уникальны', async () => {
    const { user } = renderApp('/register');
    await fill(user, { iin: IIN.learner, email: 'admin@academy.kz' });
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
    expect(await screen.findByText('Пользователь с таким ИИН уже зарегистрирован')).toBeInTheDocument();
    expect(screen.getByText('Пользователь с таким email уже зарегистрирован')).toBeInTheDocument();
  });

  it('создаёт учётную запись с ролью «Слушатель» и открывает профиль', async () => {
    const { user, router } = renderApp('/register');
    await fill(user, { iin: '990101500561', email: 'new@domain.com' });
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/learn/profile'));
    expect(await screen.findByText('Иванов Иван')).toBeInTheDocument();
    expect(screen.getByText('Слушатель')).toBeInTheDocument();
    const created = loadUsers().find((u) => u.iin === '990101500561')!;
    expect(created.roles).toEqual([{ role: 'LEARNER' }]);
    expect(created.passwordHash).not.toContain('Sanastra');
  });
});

describe('Назначение ролей в разделе «Пользователи»', () => {
  it('администратор организации назначает роль Тренер по ИИН', async () => {
    loginAs('ORGANIZATION_ADMIN');
    const { user } = renderApp('/academy/admin/m/USERS');
    const section = await screen.findByTestId('organization-users');
    expect(await within(section).findByText('Ахметов Данияр')).toBeInTheDocument();
    await user.click(within(section).getByRole('button', { name: /Назначить роль/ }));
    await user.type(await screen.findByLabelText(/ИИН пользователя/), '850315300128');
    await user.click(screen.getByLabelText(/^Роль/));
    await user.click(await screen.findByTitle('Тренер'));
    await user.click(screen.getByRole('button', { name: 'Назначить' }));
    await waitFor(() => expect(loadUsers().find((u) => u.iin === '850315300128')!.roles).toContainEqual({ role: 'TRAINER', clientSlug: 'academy' }));
    // Суперадминистраторы платформы в списке пользователей организации не отображаются
    await within(section).findByText('Ахметов Данияр');
    expect(within(section).queryByText('Касымов Нурлан')).not.toBeInTheDocument();
  });
});

async function fill(user: User, v: { iin: string; email: string }) {
  await user.type(await screen.findByLabelText(/ИИН/), v.iin);
  await user.type(screen.getByLabelText(/Фамилия/), 'Иванов');
  await user.type(screen.getByLabelText(/^Имя/), 'Иван');
  await user.type(screen.getByLabelText(/Область/), 'Астана');
  await user.click(await screen.findByTitle('г. Астана'));
  await user.type(screen.getByLabelText(/Телефон/), '7011234567');
  await user.type(screen.getByLabelText(/Email/), v.email);
  await user.type(screen.getByLabelText(/Пароль/), 'Password1');
}
