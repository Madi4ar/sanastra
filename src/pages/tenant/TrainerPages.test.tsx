import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { load } from '@/mocks/db';
import { syncMembers, saveStructure } from '@/mocks/orgStructure';
import { ensureDefaultScheme, loadProfileFields, saveProfileFields } from '@/mocks/profileFields';
import { ACADEMY_ID, loginAs, renderApp } from '@/test/utils';

function seedTrainerGroup() {
  const org = load().organizations.find((item) => item.tenantId === ACADEMY_ID)!;
  const store = syncMembers(org);
  const trainer = store.trainers.find((item) => item.userId === 'u-4')!;
  const listener = store.members.find((item) => item.userId === 'u-3')!;
  const scheme = ensureDefaultScheme(org.tenantId);
  store.groups.push({
    id: 'trainer-group-1', tenantId: org.tenantId, name: 'Группа 77', academicYear: '2026–2027', departmentId: null,
    formatId: `${org.tenantId}-course_format-1`, assessmentId: `${org.tenantId}-course_assessment-1`, courseId: `${org.tenantId}-c1`,
    profileSchemeId: scheme.id, trainerIds: [trainer.id], listenersLimit: 20, startDate: '2030-01-10', endDate: '2030-03-20',
    status: 'RECRUITING', inviteHash: '1234567890abcdef1234567890abcdef', listenerIds: [listener.id], createdAt: new Date().toISOString(),
  });
  saveStructure(store);
}

describe('Личный кабинет тренера', () => {
  it('переключает контекст на слушателя без повторной авторизации', async () => {
    loginAs('TRAINER');
    const { user, router } = renderApp('/trainer');
    await user.click(await screen.findByRole('button', { name: 'Меню профиля' }, { timeout: 5000 }));
    await user.click(await screen.findByText('Слушатель'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/learn/profile'));
  });

  it('показывает только два раздела, фильтр и закреплённую группу', async () => {
    seedTrainerGroup();
    loginAs('TRAINER');
    renderApp('/trainer');
    expect(await screen.findByRole('heading', { name: 'Мои курсы' }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByLabelText('Учебный год')).toBeInTheDocument();
    expect(screen.getByText('Шифр группы: Группа 77')).toBeInTheDocument();
    expect(screen.getByText('Количество слушателей: 1')).toBeInTheDocument();
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem')).toHaveLength(2);
  });

  it('выводит привязанную динамическую анкету и подсвечивает обязательное поле', async () => {
    const profile = loadProfileFields();
    profile.schemes.push({ id: 'trainer-scheme', tenantId: ACADEMY_ID, name: 'Анкета тренера', fields: [{ fieldId: 'global-5', required: true }] });
    profile.trainerSchemeByTenant[ACADEMY_ID] = 'trainer-scheme';
    saveProfileFields(profile);
    loginAs('TRAINER');
    renderApp('/trainer/profile');
    expect(await screen.findByText('Дополнительные поля', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('Заполните еще 1 полей')).toBeInTheDocument();
    expect(screen.getByText('Пол *')).toBeInTheDocument();
  });

  it('открывает будущий курс, сохраняет посещаемость и не пишет dry-run в прогресс', async () => {
    seedTrainerGroup();
    loginAs('TRAINER');
    const { user } = renderApp('/trainer');
    await user.click(await screen.findByRole('button', { name: 'Перейти' }));
    expect(await screen.findByRole('tab', { name: 'О курсе' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ведомость' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Выполнение элементов курса' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Открыть элемент' }));
    expect(await screen.findByTestId('element-preview')).toBeInTheDocument();
    expect(await screen.findByText('Результат не сохраняется в прогресс и аналитику группы', { exact: false })).toBeInTheDocument();
    expect(loadProfileFields().progress).toEqual([]);
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('tab', { name: 'Ведомость' }));
    const checkbox = (await screen.findAllByRole('checkbox'))[0]!;
    await user.click(checkbox);
    await waitFor(() => expect(Object.values(loadProfileFields().attendance)).toContain(true));
  });
});
