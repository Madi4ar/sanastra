import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadUsers } from '@/mocks/users';
import { loginAs, renderApp } from '@/test/utils';

describe('Суперадмин: разделы «Лимиты» и «Пользователи»', () => {
  beforeEach(() => loginAs('SUPERADMIN'));

  it('пункты левого меню открывают отдельные страницы', async () => {
    const { user, router } = renderApp('/superadmin/organizations');
    await user.click(await screen.findByRole('menuitem', { name: 'Лимиты' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/superadmin/limits'));
    expect(await screen.findByRole('heading', { name: 'Лимиты' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Пользователи' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/superadmin/users'));
    expect(await screen.findByRole('heading', { name: 'Пользователи' })).toBeInTheDocument();
  });

  it('«Лимиты»: использование и индивидуальные значения по организациям, переход в карточку', async () => {
    const { user, router } = renderApp('/superadmin/limits');
    const cell = await screen.findByTestId('limit-academy-USERS_COUNT');
    expect(cell).toHaveTextContent('82 из 150 пользователей');
    expect(cell).toHaveTextContent('Индивидуально');
    expect(screen.getByTestId('limit-academy-COURSES_COUNT')).not.toHaveTextContent('Индивидуально');
    await user.click(screen.getByText('Academy'));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/superadmin\/organizations\/7c9e6679/));
  });

  it('«Пользователи»: роли с организациями и назначение роли', async () => {
    const { user } = renderApp('/superadmin/users');
    const row = (await screen.findByText('Сапарова Алия Маратовна')).closest('tr')!;
    expect(within(row).getByText('Администратор организации · Academy')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Назначить роль/ }));
    await user.type(await screen.findByLabelText(/ИИН пользователя/), '951122300340');
    await user.type(screen.getByLabelText(/Организация/), 'Academy');
    await user.click(await screen.findByTitle('Academy'));
    await user.click(screen.getByLabelText(/^Роль/));
    await user.click(await screen.findByTitle('Тренер'));
    await user.click(screen.getByRole('button', { name: 'Назначить' }));

    const learner = (await screen.findByText('Ахметов Данияр')).closest('tr')!;
    expect(await within(learner).findByText('Тренер · Academy')).toBeInTheDocument();
    expect(loadUsers().find((u) => u.iin === '951122300340')!.roles).toContainEqual({ role: 'TRAINER', clientSlug: 'academy' });
  });
});
