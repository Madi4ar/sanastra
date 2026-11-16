import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { loginAs, renderApp } from '@/test/utils';

describe('Суперадмин: отдельный раздел «Лог действий»', () => {
  beforeEach(() => loginAs('SUPERADMIN'));

  it('открывается из левого меню и содержит таблицу и фильтры по ТЗ', async () => {
    const { user, router } = renderApp('/superadmin/roles');
    await user.click(await screen.findByRole('menuitem', { name: 'Лог действий' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/superadmin/audit'));

    expect(await screen.findByRole('heading', { name: 'Лог действий' })).toBeInTheDocument();
    expect(screen.getByLabelText('Поиск по организации или администратору')).toBeInTheDocument();
    expect(screen.getByLabelText('Фильтр по организации')).toBeInTheDocument();
    expect(screen.getByLabelText('Фильтр по модулю или событию')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Фильтр по датам')).toHaveLength(2);

    const table = await screen.findByRole('table');
    for (const column of ['Дата и время', 'Организация и пользователь', 'Модуль / Раздел', 'Тип события', 'Детали изменения (было → стало)']) {
      expect(within(table).getByRole('columnheader', { name: column })).toBeInTheDocument();
    }
    expect(await within(table).findAllByText('Создание роли')).not.toHaveLength(0);
  });

  it('не отображается внутри страницы «Роли и доступы»', async () => {
    const { user } = renderApp('/superadmin/roles');
    await user.click(await screen.findByRole('tab', { name: 'Пользовательские роли компаний' }));
    expect(await screen.findByTestId('local-roles')).toBeInTheDocument();
    expect(screen.queryByTestId('audit-trail')).not.toBeInTheDocument();
  });
});
