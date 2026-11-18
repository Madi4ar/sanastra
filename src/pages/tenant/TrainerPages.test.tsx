import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getStructure } from '@/mocks/courseBuilder';
import { load } from '@/mocks/db';
import { saveStructure, syncMembers } from '@/mocks/orgStructure';
import { ensureDefaultScheme, loadProfileFields, progressFor, saveProfileFields } from '@/mocks/profileFields';
import { ACADEMY_ID, loginAs, renderApp } from '@/test/utils';

const COURSE_ID = `${ACADEMY_ID}-c1`;

function seedGroup({ startDate = '2030-01-10', endDate = '2030-03-20', schemeId }: { startDate?: string; endDate?: string; schemeId?: string } = {}) {
  const org = load().organizations.find((item) => item.tenantId === ACADEMY_ID)!;
  const store = syncMembers(org);
  const trainer = store.trainers.find((item) => item.userId === 'u-4')!;
  const listener = store.members.find((item) => item.userId === 'u-3')!;
  store.groups.push({
    id: 'trainer-group-1', tenantId: org.tenantId, name: 'Группа 77', academicYear: '2026–2027', departmentId: null,
    formatId: `${org.tenantId}-course_format-1`, assessmentId: `${org.tenantId}-course_assessment-1`, courseId: COURSE_ID,
    profileSchemeId: schemeId ?? ensureDefaultScheme(org.tenantId).id, trainerIds: [trainer.id], listenersLimit: 20, startDate, endDate,
    status: 'RECRUITING', inviteHash: '1234567890abcdef1234567890abcdef', listenerIds: [listener.id], createdAt: new Date().toISOString(),
  });
  saveStructure(store);
  return { listener };
}

/** Схема анкеты: ИИН (из учётной записи) и Пол — обязательные */
function seedScheme(id = 'learner-scheme') {
  ensureDefaultScheme(ACADEMY_ID);
  const profile = loadProfileFields();
  profile.schemes.push({ id, tenantId: ACADEMY_ID, name: 'Анкета ПК', isDefault: false, fields: [{ fieldId: 'global-1', required: true }, { fieldId: 'global-5', required: true }] });
  saveProfileFields(profile);
  return id;
}

const elementId = (title: string) =>
  getStructure(COURSE_ID)
    .flatMap((m) => m.days.flatMap((d) => d.elements))
    .find((e) => e.titleRu === title)!.id;

describe('Личный кабинет тренера', () => {
  it('переключает контекст на слушателя без повторной авторизации', async () => {
    loginAs('TRAINER');
    const { user, router } = renderApp('/trainer');
    await user.click(await screen.findByRole('button', { name: 'Меню профиля' }, { timeout: 5000 }));
    await user.click(await screen.findByText('Слушатель'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/learn/profile'));
  });

  it('показывает только два раздела, фильтр и закреплённую группу', async () => {
    seedGroup();
    loginAs('TRAINER');
    renderApp('/trainer');
    expect(await screen.findByText('Шифр группы: Группа 77', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Мои курсы' })).toBeInTheDocument();
    expect(screen.getByLabelText('Учебный год')).toBeInTheDocument();
    expect(screen.getByText('Количество слушателей: 1')).toBeInTheDocument();
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem')).toHaveLength(2);
  });

  it('выводит привязанную динамическую анкету и подсвечивает обязательное поле', async () => {
    const profile = loadProfileFields();
    profile.schemes.push({ id: 'trainer-scheme', tenantId: ACADEMY_ID, name: 'Анкета тренера', isDefault: false, fields: [{ fieldId: 'global-5', required: true }] });
    profile.trainerSchemeByTenant[ACADEMY_ID] = 'trainer-scheme';
    saveProfileFields(profile);
    loginAs('TRAINER');
    renderApp('/trainer/profile');
    expect(await screen.findByText('Заполните еще 1 полей анкеты', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('Обязательно для заполнения')).toBeInTheDocument();
  });

  it('проходит тест в песочнице без записи в прогресс и отмечает посещаемость', async () => {
    seedGroup();
    loginAs('TRAINER');
    const { user } = renderApp('/trainer');
    await user.click(await screen.findByRole('button', { name: 'Перейти' }, { timeout: 5000 }));
    expect(await screen.findByRole('tab', { name: 'О курсе' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ведомость' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Выполнение элементов курса' })).toBeInTheDocument();

    await user.click(screen.getByText('Тест по модулю 1'));
    await user.click(await screen.findByRole('radio', { name: '6' }));
    await user.type(screen.getByLabelText('Ответ на вопрос 2'), 'сумма');
    await user.click(screen.getByRole('button', { name: 'Завершить тест' }));
    expect(await screen.findByText('Тест сдан')).toBeInTheDocument();
    expect(screen.getByText(/результат не сохранён/)).toBeInTheDocument();
    expect(loadProfileFields().progress).toEqual([]);

    await user.click(screen.getByRole('tab', { name: 'Ведомость' }));
    await user.click(await screen.findByRole('checkbox', { name: /День 1\. Знакомство/ }));
    await waitFor(() => expect(Object.values(loadProfileFields().attendance)).toContain(true));
  });

  it('видит отправленную слушателем работу «На проверке» и принимает её', async () => {
    seedGroup();
    const store = loadProfileFields();
    progressFor('trainer-group-1', 'u-3', store).elements[elementId('Практическая работа № 1')] = { work: { answer: 'Решение', done: false, score: null } };
    saveProfileFields(store);
    loginAs('TRAINER');
    const { user } = renderApp('/trainer/courses/trainer-group-1');
    await user.click(await screen.findByRole('tab', { name: 'Выполнение элементов курса' }, { timeout: 5000 }));
    expect(await screen.findByText('На проверке')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Принять работу/ }));
    expect(await screen.findByText('Выполнено')).toBeInTheDocument();
  });
});

describe('Личный кабинет слушателя', () => {
  it('сообщает, что курс еще не начался', async () => {
    seedGroup({ startDate: '2099-01-10', endDate: '2099-03-20' });
    loginAs('LEARNER');
    const { user } = renderApp('/learn');
    await user.click(await screen.findByRole('button', { name: /Начать курс/ }, { timeout: 5000 }));
    expect(await screen.findByText('Курс еще не начался. Пожалуйста, ожидайте даты начала 10.01.2099')).toBeInTheDocument();
  });

  it('не пускает к обучению без анкеты, а после её заполнения открывает курс', async () => {
    seedGroup({ startDate: '2020-01-10', endDate: '2099-03-20', schemeId: seedScheme() });
    loginAs('LEARNER');
    const { user, router } = renderApp('/learn');
    expect(await screen.findByText(/не заполнено обязательных полей — 1/, {}, { timeout: 5000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Начать курс/ }));
    await user.click(await screen.findByRole('button', { name: 'Перейти в профиль' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/learn/profile'));

    // ИИН подставлен из учётной записи и не считается незаполненным
    expect(await screen.findByText('Заполните еще 1 полей для доступа к обучению')).toBeInTheDocument();
    expect(screen.getAllByText('Из учётной записи')).toHaveLength(1);
    await user.click(within(screen.getByRole('form', { name: /Группа 77/ })).getByRole('combobox'));
    await user.click(await screen.findByTitle('Женский'));
    await user.click(within(screen.getByRole('form', { name: /Группа 77/ })).getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(screen.queryByText(/полей для доступа к обучению/)).not.toBeInTheDocument());

    await router.navigate('/learn');
    await user.click(await screen.findByRole('button', { name: /Начать курс/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/learn/courses/trainer-group-1'));
    expect(await screen.findByText('Содержание')).toBeInTheDocument();
  });

  it('сдаёт тест: результат и прогресс сохраняются по группе', async () => {
    seedGroup({ startDate: '2020-01-10', endDate: '2099-03-20' });
    loginAs('LEARNER');
    const { user } = renderApp('/learn/courses/trainer-group-1');
    await user.click(await screen.findByText(/Тест по модулю 1/, {}, { timeout: 5000 }));
    await user.click(await screen.findByRole('radio', { name: '6' }));
    await user.type(screen.getByLabelText('Ответ на вопрос 2'), 'сумма');
    await user.click(screen.getByRole('button', { name: 'Завершить тест' }));
    expect(await screen.findByText('Тест сдан')).toBeInTheDocument();
    const state = loadProfileFields().progress.find((p) => p.groupId === 'trainer-group-1' && p.userId === 'u-3')!;
    expect(state.elements[elementId('Тест по модулю 1')]?.test).toMatchObject({ passed: true, percent: 100 });
  });

  it('архивная группа открывается только для обзора', async () => {
    seedGroup({ startDate: '2020-01-10', endDate: '2020-03-20' });
    loginAs('LEARNER');
    const { user } = renderApp('/learn');
    await user.click(await screen.findByRole('button', { name: /Обзор курса/ }, { timeout: 5000 }));
    expect(await screen.findByText(/Курс находится в архиве/)).toBeInTheDocument();
  });
});
