import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { api } from '@/api/endpoints';
import type { OrgGroupPayload } from '@/api/types';
import { load, save, TARIFFS } from '@/mocks/db';
import { listCourses } from '@/mocks/content';
import { loadStructure } from '@/mocks/orgStructure';
import { loadProfileFields } from '@/mocks/profileFields';
import { ACADEMY_ID, loginAs, renderApp } from '@/test/utils';

function useTariff(code: 'basic' | 'business') {
  const db = load();
  db.organizations.find((o) => o.tenantId === ACADEMY_ID)!.tariffPlanId = TARIFFS.find((t) => t.code === code)!.id;
  save(db);
}

async function groupPayload(profileSchemeId: string | null): Promise<OrgGroupPayload> {
  const org = load().organizations.find((o) => o.tenantId === ACADEMY_ID)!;
  const course = listCourses(org)[0]!;
  const options = await api.tenantAdmin('academy').groupOptions();
  return {
    academicYear: options.academicYears[0]!,
    departmentId: null,
    formatId: course.formatIds[0]!,
    assessmentId: course.assessmentIds[0]!,
    courseId: course.id,
    profileSchemeId,
    trainerIds: [],
    listenersLimit: 10,
    startDate: '2030-01-10',
    endDate: '2030-02-10',
    status: 'RECRUITING',
    inviteHash: null,
  };
}

describe('Конструктор полей профиля', () => {
  it('создаёт выпадающее поле со справочником на трёх языках', async () => {
    useTariff('business');
    loginAs('ORGANIZATION_ADMIN');
    const { user } = renderApp('/academy/admin/profile-fields');
    await user.click(await screen.findByRole('button', { name: 'Создать поле' }, { timeout: 5000 }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Название \(KZ\)/), 'Педагогикалық өтілі');
    await user.type(within(dialog).getByLabelText(/Название \(RU\)/), 'Педагогический стаж');
    await user.type(within(dialog).getByLabelText(/Название \(EN\)/), 'Teaching experience');
    await user.click(within(dialog).getByLabelText('Тип поля'));
    await user.click(await screen.findByTitle('Выпадающий список'));
    await user.type(within(dialog).getByLabelText('Значение 1 (KZ)'), '5 жылға дейін');
    await user.type(within(dialog).getByLabelText('Значение 1 (RU)'), 'До 5 лет');
    await user.type(within(dialog).getByLabelText('Значение 1 (EN)'), 'Under 5 years');
    await user.click(within(dialog).getByRole('button', { name: 'Создать' }));

    expect(await screen.findByText('Педагогический стаж')).toBeInTheDocument();
    expect(screen.getByText('До 5 лет')).toBeInTheDocument();
    const store = loadProfileFields();
    const field = store.custom.find((f) => f.labelRu === 'Педагогический стаж')!;
    expect(store.directories.find((d) => d.id === field.directoryId)).toMatchObject({ tenantId: ACADEMY_ID, items: [expect.objectContaining({ labelEn: 'Under 5 years' })] });
    expect(loadStructure().audit[0]).toMatchObject({ event: 'PROFILE_FIELD_CREATED', module: 'PROFILE_FIELDS' });
  });

  it('редактирует и удаляет поля и схемы; основную и привязанную схему удалить нельзя', async () => {
    useTariff('business');
    loginAs('ORGANIZATION_ADMIN');
    const fields = api.profileFields('academy');
    let data = await fields.createField({ labelKz: 'Өтіл', labelRu: 'Стаж', labelEn: 'Experience', type: 'TEXT', options: [] });
    const fieldId = data.custom[0]!.id;
    data = await fields.updateField(fieldId, { labelKz: 'Өтіл', labelRu: 'Общий стаж', labelEn: 'Experience', type: 'TEXT', options: [] });
    expect(data.custom[0]!.labelRu).toBe('Общий стаж');

    data = await fields.createScheme({ name: 'Расширенная карточка ПК', fields: [{ fieldId, required: true }] });
    const scheme = data.schemes.find((s) => s.name === 'Расширенная карточка ПК')!;
    const main = data.schemes.find((s) => s.isDefault)!;
    await expect(fields.removeScheme(main.id)).rejects.toThrow('Основную схему удалить нельзя.');

    await api.tenantAdmin('academy').createGroup(await groupPayload(scheme.id));
    await expect(fields.removeScheme(scheme.id)).rejects.toThrow(/привязана к учебным группам/);

    data = await fields.removeField(fieldId);
    expect(data.custom).toHaveLength(0);
    expect(data.schemes.find((s) => s.id === scheme.id)!.fields).toHaveLength(0);
  });

  it('без модуля в тарифе схема не выбирается, группе назначается основная', async () => {
    useTariff('basic');
    loginAs('ORGANIZATION_ADMIN');
    const options = await api.tenantAdmin('academy').groupOptions();
    expect(options).toMatchObject({ canAttachProfileScheme: false, profileSchemes: [] });
    const group = await api.tenantAdmin('academy').createGroup(await groupPayload(null));
    expect(group.profileSchemeName).toBe('Основная схема');
    await expect(api.profileFields('academy').get()).rejects.toThrow();
    expect(loadStructure().audit[0]).toMatchObject({ event: 'GROUP_CREATED', module: 'GROUPS' });
  });
});

describe('Реестр глобальных полей суперадминистратора', () => {
  it('добавляет и изменяет глобальное поле, тип полей учётной записи не меняется', async () => {
    loginAs('SUPERADMIN');
    const created = await api.profileFieldsRegistry.create({
      labelKz: 'Стаж', labelRu: 'Стаж работы', labelEn: 'Work experience', type: 'TEXT', options: [], active: true, inTrainerProfile: true, trainerRequired: true,
    });
    expect(created).toMatchObject({ inTrainerProfile: true, trainerRequired: true, accountField: false });
    const iin = (await api.profileFieldsRegistry.list()).find((f) => f.labelRu === 'ИИН')!;
    const updated = await api.profileFieldsRegistry.update(iin.id, {
      labelKz: 'ЖСН', labelRu: 'ИИН', labelEn: 'IIN', type: 'DROPDOWN', options: [{ id: 'x', labelKz: 'a', labelRu: 'a', labelEn: 'a' }], active: true, inTrainerProfile: false, trainerRequired: false,
    });
    expect(updated.type).toBe('TEXT');
    expect(loadProfileFields().globals.some((f) => f.labelRu === 'Стаж работы')).toBe(true);
  });

  it('показывает реестр и форму добавления', async () => {
    loginAs('SUPERADMIN');
    const { user } = renderApp('/superadmin/profile-fields');
    expect(await screen.findByText('Научный уровень', {}, { timeout: 5000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Добавить поле' }));
    expect(await screen.findByText('Новое глобальное поле')).toBeInTheDocument();
  });
});

describe('Журнал действий', () => {
  it('фиксирует изменение группы с параметрами было и стало', async () => {
    useTariff('business');
    loginAs('ORGANIZATION_ADMIN');
    const admin = api.tenantAdmin('academy');
    const schemeId = (await admin.groupOptions()).profileSchemes[0]!.id;
    const payload = await groupPayload(schemeId);
    const group = await admin.createGroup(payload);
    await admin.updateGroup(group.id, { ...payload, listenersLimit: 25 });
    const entry = loadStructure().audit.find((a) => a.event === 'GROUP_UPDATED')!;
    expect(entry.changes).toContainEqual({ field: 'Лимит слушателей', oldValue: '10', newValue: '25' });
  });
});
