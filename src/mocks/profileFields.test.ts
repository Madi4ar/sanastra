import { beforeEach, describe, expect, it } from 'vitest';
import type { CourseElement } from '@/api/types';
import {
  elementProgress,
  fieldsForTenant,
  formFields,
  gradeTest,
  loadProfileFields,
  missingCount,
  percentOf,
  progressFor,
  resetProfileFields,
  saveProfileFields,
  schemesForTenant,
  withoutAnswers,
} from './profileFields';

const test = (questions: unknown[], pass = 50): CourseElement => ({
  id: 'test-1',
  type: 'test',
  titleRu: 'Тест',
  titleKz: 'Тест',
  required: true,
  hidden: false,
  files: [],
  updatedAt: '',
  settings: { pass_percent: pass, attempts: null, questions } as unknown as Record<string, unknown>,
});

const question = (patch: Record<string, unknown>) => ({
  id: crypto.randomUUID(),
  text_ru: 'Вопрос',
  points: 1,
  options: [],
  pairs: [],
  items: [],
  rows: [],
  gap_answers: [],
  numeric_value: null,
  numeric_tolerance: 0,
  short_answers: '',
  ...patch,
});

describe('конструктор полей профиля', () => {
  beforeEach(() => resetProfileFields());

  it('содержит заданный ТЗ глобальный реестр и создаёт основную схему компании', () => {
    expect(loadProfileFields().globals.map((field) => field.labelRu)).toEqual([
      'ИИН', 'ФИО', 'Email', 'Телефон', 'Пол', 'Национальность', 'Область', 'Район', 'Должность', 'Образование', 'Научный уровень', 'Категория', 'Организация образования',
    ]);
    expect(fieldsForTenant('tenant-1')).toHaveLength(13);
    expect(schemesForTenant('tenant-1')).toEqual([expect.objectContaining({ name: 'Основная схема', tenantId: 'tenant-1', isDefault: true })]);
  });

  it('берёт ИИН и ФИО из учётной записи и считает их заполненными', () => {
    const store = loadProfileFields();
    const rows = [
      { fieldId: 'global-1', required: true },
      { fieldId: 'global-2', required: true },
      { fieldId: 'global-5', required: true },
    ];
    const fields = formFields(store, 'tenant-1', 'user-1', { iin: '900101300123', fullName: 'Иванов Иван', email: 'a@b.kz', phone: '' }, rows);
    expect(fields.map((f) => [f.label, f.value, f.readonly])).toEqual([
      ['ИИН', '900101300123', true],
      ['ФИО', 'Иванов Иван', true],
      ['Пол', '', false],
    ]);
    expect(missingCount(fields)).toBe(1);
  });

  it('хранит прогресс отдельно для каждой группы', () => {
    const store = loadProfileFields();
    progressFor('group-1', 'learner-1', store).elements['e-1'] = { viewed: true };
    saveProfileFields(store);
    expect(progressFor('group-2', 'learner-1').elements).toEqual({});
    expect(progressFor('group-1', 'learner-1').elements['e-1']).toEqual({ viewed: true });
  });
});

describe('проверка тестов', () => {
  it('оценивает выбор, число и короткий ответ; эссе уходит тренеру', () => {
    const single = question({ type: 'single', points: 2, options: [{ id: 'a', ru: 'A', kz: '', correct: true }, { id: 'b', ru: 'B', kz: '', correct: false }] });
    const numeric = question({ type: 'numeric', numeric_value: 10, numeric_tolerance: 0.5 });
    const short = question({ type: 'short', short_answers: 'Астана\nНур-Султан' });
    const essay = question({ type: 'essay' });
    const element = test([single, numeric, short, essay], 75);

    expect(gradeTest(element, { [single.id]: 'a', [numeric.id]: '10.3', [short.id]: ' астана ' })).toEqual({
      score: 4, maxScore: 4, percent: 100, passed: true, manualQuestions: 1,
    });
    expect(gradeTest(element, { [single.id]: 'b', [numeric.id]: '10', [short.id]: 'Алматы' })).toMatchObject({ score: 1, percent: 25, passed: false });
  });

  it('не передаёт слушателю верные ответы', () => {
    const single = question({ type: 'single', options: [{ id: 'a', ru: 'A', kz: '', correct: true }] });
    const safe = withoutAnswers(test([single]));
    const q = (safe.settings as { questions: { options: { correct: boolean }[] }[] }).questions[0]!;
    expect(q.options[0]!.correct).toBe(false);
  });

  it('засчитывает сданный тест и отправленную работу в прогресс', () => {
    const work: CourseElement = { ...test([]), id: 'w', type: 'assignment' };
    const doc: CourseElement = { ...test([]), id: 'd', type: 'document' };
    const record = { groupId: 'g', userId: 'u', elements: { 'test-1': { test: { score: 1, maxScore: 1, percent: 100, passed: true } }, w: { work: { answer: 'ответ', done: false, score: null } } } };
    expect(elementProgress(work, record.elements.w).status).toBe('WORK_ON_REVIEW');
    expect(percentOf([test([]), work, doc], record)).toBe(67);
  });
});
