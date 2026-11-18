import { beforeEach, describe, expect, it } from 'vitest';
import { fieldsForTenant, loadProfileFields, progressFor, resetProfileFields, saveProfileFields, schemesForTenant } from './profileFields';

describe('конструктор полей профиля', () => {
  beforeEach(() => resetProfileFields());

  it('содержит заданный ТЗ глобальный реестр и создаёт схему компании', () => {
    expect(loadProfileFields().globals.map((field) => field.labelRu)).toEqual([
      'ИИН', 'ФИО', 'Email', 'Телефон', 'Пол', 'Национальность', 'Область', 'Район', 'Должность', 'Образование', 'Уровень науки', 'Категория', 'Организация образования',
    ]);
    expect(fieldsForTenant('tenant-1')).toHaveLength(13);
    expect(schemesForTenant('tenant-1')).toEqual([expect.objectContaining({ name: 'Основная схема', tenantId: 'tenant-1' })]);
  });

  it('хранит прогресс, ответы и оценки отдельно для каждой группы', () => {
    const first = progressFor('group-1', 'learner-1');
    first.completedElementIds.push('element-1');
    first.answers['test-1'] = 'answer';
    first.grades['test-1'] = 90;
    saveProfileFields(loadProfileFields());

    const repeat = progressFor('group-2', 'learner-1');
    expect(repeat.completedElementIds).toEqual([]);
    expect(repeat.answers).toEqual({});
    expect(repeat.grades).toEqual({});
    expect(progressFor('group-1', 'learner-1')).toMatchObject({ completedElementIds: ['element-1'], answers: { 'test-1': 'answer' }, grades: { 'test-1': 90 } });
  });
});
