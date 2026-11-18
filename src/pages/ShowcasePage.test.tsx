import { screen, waitFor, within } from '@testing-library/react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '@/api/endpoints';
import { listCourses } from '@/mocks/content';
import { load, save, TARIFFS } from '@/mocks/db';
import { loadStructure, saveStructure } from '@/mocks/orgStructure';
import { loadRegistry } from '@/mocks/registry';
import { fullNameOf, loadUsers } from '@/mocks/users';
import { loginAs, renderApp } from '@/test/utils';

const GROUP_ID = 'showcase-group';
const INVITE_HASH = '0123456789abcdef0123456789abcdef';

function prepareGroup() {
  const org = load().organizations.find((item) => item.clientSlug === 'academy')!;
  const course = listCourses(org).find((item) => item.status === 'PUBLISHED')!;
  const store = loadStructure();
  store.groups.push({
    id: GROUP_ID,
    tenantId: org.tenantId,
    name: 'Группа витрины',
    academicYear: `${dayjs().year()}–${dayjs().year() + 1}`,
    departmentId: null,
    formatId: course.formatIds[0]!,
    assessmentId: course.assessmentIds[0]!,
    courseId: course.id,
    trainerIds: [],
    listenersLimit: 20,
    startDate: dayjs().add(10, 'day').format('YYYY-MM-DD'),
    endDate: dayjs().add(40, 'day').format('YYYY-MM-DD'),
    status: 'RECRUITING',
    inviteHash: INVITE_HASH,
    listenerIds: [],
    createdAt: new Date().toISOString(),
  });
  saveStructure(store);
  return { org, course };
}

async function submitApplication(user: ReturnType<typeof renderApp>['user'], courseTitle: string, fullName: string, email: string) {
  await user.click(await screen.findByRole('link', { name: courseTitle }));
  await user.click(await screen.findByRole('button', { name: 'Оставить заявку' }));
  const form = screen.getByRole('form', { name: 'Заявка с витрины' });
  await user.type(within(form).getByLabelText(/^ФИО/), fullName);
  await user.type(within(form).getByLabelText(/^Email/), email);
  await user.type(within(form).getByLabelText(/^Номер телефона/), '7012223344');
  await user.click(screen.getByRole('button', { name: 'Отправить' }));
  expect(await screen.findByText('Заявка отправлена')).toBeInTheDocument();
}

describe('Витрина курсов и заявки', () => {
  beforeEach(() => loginAs(null));

  it('добавляет два отдельных модуля в реестр и тарифы по ТЗ', () => {
    expect(loadRegistry().find((module) => module.key === 'lms_course_showcase')?.options.map((option) => option.key)).toEqual([
      'lms_course_showcase.catalog_view',
      'lms_course_showcase.submit_application',
    ]);
    expect(loadRegistry().find((module) => module.key === 'lms_showcase_applications')?.options.map((option) => option.key)).toEqual([
      'lms_showcase_applications.view',
      'lms_showcase_applications.confirm',
      'lms_showcase_applications.reject',
    ]);
    expect(TARIFFS.find((tariff) => tariff.code === 'basic')?.modules).toMatchObject({ COURSE_SHOWCASE: true, SHOWCASE_APPLICATIONS: false });
    expect(TARIFFS.find((tariff) => tariff.code === 'business')?.modules).toMatchObject({ COURSE_SHOWCASE: true, SHOWCASE_APPLICATIONS: true });
  });

  it('на базовом тарифе отправляет заявку без внутреннего реестра', async () => {
    const { course } = prepareGroup();
    const { user } = renderApp('/academy/learn');
    await submitApplication(user, course.title, 'Иванов Иван', 'showcase-basic@example.com');
    expect(loadStructure().applications).toHaveLength(0);
  });

  it('на расширенном тарифе сохраняет заявку, подтверждает и зачисляет слушателя', async () => {
    const { org } = prepareGroup();
    const db = load();
    db.organizations.find((item) => item.tenantId === org.tenantId)!.tariffPlanId = TARIFFS.find((tariff) => tariff.code === 'business')!.id;
    save(db);

    await api.showcase.apply('academy', GROUP_ID, {
      fullName: 'Иванов Иван Иванович',
      email: 'showcase-business@example.com',
      phone: '7012223344',
    });
    await waitFor(() => expect(loadStructure().applications[0]?.status).toBe('NEW'));

    loginAs('ORGANIZATION_ADMIN');
    const admin = api.tenantAdmin('academy');
    const [application] = await admin.groupApplications(GROUP_ID);
    expect(application).toMatchObject({ email: 'showcase-business@example.com', status: 'NEW' });
    await admin.confirmApplication(GROUP_ID, application!.id);

    await waitFor(() => expect(loadStructure().applications[0]?.status).toBe('CONFIRMED'));
    expect(loadStructure().groups.find((group) => group.id === GROUP_ID)?.listenerIds).toHaveLength(1);
  });

  it('подтверждение ищет пользователя только по Email: однофамилец не зачисляется', async () => {
    const { org } = prepareGroup();
    const db = load();
    db.organizations.find((item) => item.tenantId === org.tenantId)!.tariffPlanId = TARIFFS.find((tariff) => tariff.code === 'business')!.id;
    save(db);
    const namesake = loadUsers().find((u) => u.id === 'u-3')!;
    await api.showcase.apply('academy', GROUP_ID, { fullName: fullNameOf(namesake), email: 'another-person@example.com', phone: '7012223344' });

    loginAs('ORGANIZATION_ADMIN');
    const admin = api.tenantAdmin('academy');
    const [application] = await admin.groupApplications(GROUP_ID);
    await admin.confirmApplication(GROUP_ID, application!.id);

    const created = loadUsers().find((u) => u.email === 'another-person@example.com');
    expect(created).toBeDefined();
    expect(created!.id).not.toBe(namesake.id);
    const store = loadStructure();
    const listener = store.members.find((m) => m.id === store.groups.find((g) => g.id === GROUP_ID)!.listenerIds[0]);
    expect(listener?.userId).toBe(created!.id);
    expect(store.audit[0]).toMatchObject({ event: 'APPLICATION_CONFIRMED', module: 'SHOWCASE' });
  });

  it('не принимает заявку в заполненную группу', async () => {
    prepareGroup();
    const store = loadStructure();
    store.groups.find((g) => g.id === GROUP_ID)!.listenersLimit = 0;
    saveStructure(store);
    await expect(api.showcase.apply('academy', GROUP_ID, { fullName: 'Петров Пётр', email: 'p@example.com', phone: '7012223344' })).rejects.toThrow('В группе нет свободных мест.');
  });

  it('по прямой ссылке зачисляет авторизованного слушателя без заявки', async () => {
    prepareGroup();
    loginAs('LEARNER');
    renderApp(`/invite/group/${INVITE_HASH}`);
    expect(await screen.findByText('Вы зачислены в группу')).toBeInTheDocument();
    expect(loadStructure().applications).toHaveLength(0);
    expect(loadStructure().groups.find((group) => group.id === GROUP_ID)?.listenerIds).toHaveLength(1);
  });
});
